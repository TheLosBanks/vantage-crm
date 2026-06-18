import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.CRM_SECRET || "dev-secret-change-me";
const PASSWORD = process.env.CRM_PASSWORD || "";
const COOKIE = "vw_crm";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export function checkPassword(pw: string): boolean {
  if (!PASSWORD) return false;
  const a = Buffer.from(pw);
  const b = Buffer.from(PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionToken(): string {
  const stamp = "ok";
  return `${stamp}.${sign(stamp)}`;
}

export async function isAuthed(): Promise<boolean> {
  const c = await cookies();
  const val = c.get(COOKIE)?.value || "";
  const [stamp, sig] = val.split(".");
  return Boolean(stamp) && sig === sign(stamp);
}

export const COOKIE_NAME = COOKIE;
