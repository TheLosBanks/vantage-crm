import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Named logins, so a trial can actually be judged.
 *
 * The CRM had one shared password, which meant handing a new hire Carlos's own
 * credentials and having no way to tell whose calls were whose. With ten paid
 * hours on the line, "he says he made 90 calls" is not something you want to
 * take on trust.
 *
 * Users live in one env var rather than a table. Adding someone is a line,
 * removing them is deleting it. For two or three people that is the right size,
 * and a signup flow nobody asked for is not.
 *
 *   CRM_USERS="carlos:somepassword,aaryan:anotherpassword"
 *
 * CRM_PASSWORD still works on its own, so nothing breaks if the new var is
 * never set.
 */

const SECRET = process.env.CRM_SECRET || "dev-secret-change-me";
const COOKIE = "vw_crm";

type User = { name: string; password: string };

function users(): User[] {
  const raw = (process.env.CRM_USERS || "").trim();
  const list: User[] = raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(":");
      return i === -1
        ? null
        : { name: pair.slice(0, i).trim().toLowerCase(), password: pair.slice(i + 1) };
    })
    .filter((u): u is User => Boolean(u && u.name && u.password));

  // The original single password keeps working, as "carlos".
  const legacy = process.env.CRM_PASSWORD;
  if (legacy && !list.some((u) => u.name === "carlos")) {
    list.push({ name: "carlos", password: legacy });
  }
  return list;
}

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Constant-time, so a wrong password cannot be found by timing the response. */
function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns the user's name on success, null otherwise. */
export function authenticate(name: string, password: string): string | null {
  const wanted = (name || "").trim().toLowerCase();
  for (const u of users()) {
    // Compare against every user rather than breaking early, so the response
    // does not reveal which names exist.
    if (u.name === wanted && same(password || "", u.password)) return u.name;
  }
  return null;
}

export function sessionToken(name: string): string {
  return `${name}.${sign(name)}`;
}

/** The logged-in user's name, or null. Every write is stamped with this. */
export async function currentUser(): Promise<string | null> {
  const c = await cookies();
  const val = c.get(COOKIE)?.value || "";
  const i = val.lastIndexOf(".");
  if (i === -1) return null;
  const name = val.slice(0, i);
  const sig = val.slice(i + 1);
  if (!name || sig !== sign(name)) return null;
  return name;
}

export async function isAuthed(): Promise<boolean> {
  return (await currentUser()) !== null;
}

export const COOKIE_NAME = COOKIE;
