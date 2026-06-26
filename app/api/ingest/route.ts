import { NextResponse } from "next/server";
import { upsertLead, markStatusByEmail, getPool } from "@/lib/db";

// Pipeline feed: the local scraper/drafter POST here to sync leads + statuses.
// Auth via a shared INGEST_TOKEN (not the user password).
export async function POST(request: Request) {
  const token = request.headers.get("x-ingest-token") || "";
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!getPool()) return NextResponse.json({ error: "no database" }, { status: 503 });

  let body: {
    leads?: Array<{ name: string; category?: string; phone?: string; email?: string; instagram?: string; linkedin?: string; website?: string; script?: string }>;
    mark?: Array<{ email: string; status: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  let upserted = 0;
  let marked = 0;
  for (const l of body.leads || []) {
    if (!l.name) continue;
    await upsertLead({
      name: l.name, category: l.category || "", phone: l.phone || "",
      email: l.email || "", instagram: l.instagram || "", linkedin: l.linkedin || "",
      website: l.website || "", script: l.script || "",
    });
    upserted++;
  }
  for (const m of body.mark || []) {
    if (!m.email || !m.status) continue;
    await markStatusByEmail(m.email, m.status);
    marked++;
  }
  return NextResponse.json({ ok: true, upserted, marked });
}
