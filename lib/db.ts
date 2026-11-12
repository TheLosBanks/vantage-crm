import { Pool } from "pg";

// Find the Postgres connection string regardless of how Vercel/Neon named it.
// The Neon integration injects vars under a configurable prefix (e.g. STORAGE_,
// POSTGRES_, DATABASE_), so check the well-known names first, then any env var
// ending in DATABASE_URL / POSTGRES_URL / _URL that looks like a postgres DSN.
function findConn(): string {
  const direct = [
    process.env.DATABASE_URL, process.env.POSTGRES_URL,
    process.env.STORAGE_URL, process.env.STORAGE_DATABASE_URL,
    process.env.STORAGE_POSTGRES_URL, process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL_UNPOOLED, process.env.POSTGRES_URL_NON_POOLING,
  ].find(Boolean);
  if (direct) return direct;
  for (const [k, v] of Object.entries(process.env)) {
    if (v && /^postgres(ql)?:\/\//.test(v) && /(DATABASE_URL|POSTGRES_URL|_URL)$/.test(k)) {
      return v;
    }
  }
  return "";
}
const CONN = findConn();

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!CONN) return null;
  if (!pool) {
    pool = new Pool({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

export const STATUSES = ["New", "Drafted", "Sent", "Replied", "Booked", "Closed"] as const;
export type Status = (typeof STATUSES)[number];

export type Lead = {
  id: number;
  name: string;
  category: string;
  phone: string;
  email: string;
  instagram: string;
  linkedin: string;
  website: string;
  status: string;
  notes: string;
  script: string;
  /** Who last changed this lead. Empty for anything touched before named logins. */
  updated_by?: string;
};

let schemaReady = false;
export async function ensureSchema(): Promise<void> {
  const p = getPool();
  if (!p || schemaReady) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      instagram TEXT DEFAULT '',
      linkedin TEXT DEFAULT '',
      website TEXT DEFAULT '',
      status TEXT DEFAULT 'New',
      notes TEXT DEFAULT '',
      script TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (name, email)
    );
  `);
  // Migration for tables created before the script column existed.
  await p.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS script TEXT DEFAULT ''`);
  // Who last touched a lead. Without this a trial cannot be judged: there is no
  // way to tell a new hire's calls from anyone else's.
  await p.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_by TEXT DEFAULT ''`);
  // Site events (call taps, quote submits, etc.) from the client sites.
  await p.query(`
    CREATE TABLE IF NOT EXISTS site_events (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      ts TIMESTAMPTZ DEFAULT now()
    );
  `);
  schemaReady = true;
}

export async function recordEvent(source: string, type: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  await ensureSchema();
  await p.query("INSERT INTO site_events (source, type) VALUES ($1, $2)", [source.slice(0, 80), type.slice(0, 80)]);
}

export async function clearEvents(source: string): Promise<number> {
  const p = getPool();
  if (!p) return 0;
  await ensureSchema();
  const { rowCount } = await p.query("DELETE FROM site_events WHERE source = $1", [source]);
  return rowCount ?? 0;
}

export async function eventReport(source: string, days: number): Promise<{ type: string; n: number }[]> {
  const p = getPool();
  if (!p) return [];
  await ensureSchema();
  const { rows } = await p.query(
    `SELECT type, COUNT(*)::int AS n FROM site_events
     WHERE source = $1 AND ts >= now() - ($2 || ' days')::interval
     GROUP BY type ORDER BY n DESC`,
    [source, String(days)]
  );
  return rows as { type: string; n: number }[];
}

async function seedIfEmpty(): Promise<void> {
  const p = getPool();
  if (!p) return;
  const { rows } = await p.query("SELECT COUNT(*)::int AS n FROM leads");
  if (rows[0].n > 0) return;
  const { SEED } = await import("./seed-data");
  for (const l of SEED) {
    await upsertLead({ name: l.name, category: l.category, phone: l.phone, email: l.email, instagram: l.instagram, linkedin: l.linkedin, website: l.website });
  }
}

export async function listLeads(): Promise<Lead[]> {
  const p = getPool();
  if (!p) return [];
  await ensureSchema();
  await seedIfEmpty();
  const r = await p.query(
    `SELECT id,name,category,phone,email,instagram,linkedin,website,status,notes,script
     FROM leads ORDER BY
       CASE status WHEN 'Booked' THEN 0 WHEN 'Replied' THEN 1 WHEN 'Sent' THEN 2
                   WHEN 'Drafted' THEN 3 WHEN 'New' THEN 4 ELSE 5 END,
       name ASC`
  );
  return r.rows as Lead[];
}

// Fills a lead's email only when it is empty; never overwrites one already on file.
export async function fillLeadEmail(id: number, email: string, by?: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  await ensureSchema();
  const r = await p.query(
    `UPDATE leads SET email = $1, updated_by = COALESCE($3, updated_by), updated_at = now()
     WHERE id = $2 AND COALESCE(email, '') = ''`,
    [email, id, by ?? null],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function updateLead(
  id: number,
  fields: Partial<Pick<Lead, "status" | "notes" | "script">>,
  by?: string,
): Promise<void> {
  const p = getPool();
  if (!p) return;
  await ensureSchema();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (by) {
    vals.push(by);
    sets.push(`updated_by = $${vals.length}`);
  }
  if (typeof fields.status === "string") {
    vals.push(fields.status);
    sets.push(`status = $${vals.length}`);
  }
  if (typeof fields.notes === "string") {
    vals.push(fields.notes);
    sets.push(`notes = $${vals.length}`);
  }
  if (typeof fields.script === "string") {
    vals.push(fields.script);
    sets.push(`script = $${vals.length}`);
  }
  if (!sets.length) return;
  vals.push(id);
  await p.query(`UPDATE leads SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length}`, vals);
}

// Mark a lead's status by email (used by the drafter: email → "Drafted").
// Never downgrades a lead that's already past the target stage.
const STAGE_ORDER = ["New", "Drafted", "Sent", "Replied", "Booked", "Closed"];
export async function markStatusByEmail(email: string, status: string): Promise<void> {
  const p = getPool();
  if (!p || !email) return;
  await ensureSchema();
  const target = STAGE_ORDER.indexOf(status);
  await p.query(
    `UPDATE leads SET status=$1, updated_at=now()
     WHERE lower(email)=lower($2)
       AND COALESCE(array_position($3::text[], status), 0) < $4`,
    [status, email, STAGE_ORDER, target < 0 ? 99 : target + 1]
  );
}

// Upsert from the lead pipeline (scraper/drafter). Status set only on insert.
export async function upsertLead(
  l: Omit<Lead, "id" | "status" | "notes" | "script"> & { status?: string; script?: string }
): Promise<void> {
  const p = getPool();
  if (!p) return;
  await ensureSchema();
  await p.query(
    `INSERT INTO leads (name,category,phone,email,instagram,linkedin,website,status,script)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (name,email) DO UPDATE SET
       phone=EXCLUDED.phone, instagram=EXCLUDED.instagram,
       linkedin=EXCLUDED.linkedin, website=EXCLUDED.website,
       category=CASE WHEN EXCLUDED.category <> '' THEN EXCLUDED.category ELSE leads.category END,
       script=CASE WHEN EXCLUDED.script <> '' THEN EXCLUDED.script ELSE leads.script END,
       updated_at=now()`,
    [l.name, l.category, l.phone, l.email, l.instagram, l.linkedin, l.website, l.status || "New", l.script || ""]
  );
}
