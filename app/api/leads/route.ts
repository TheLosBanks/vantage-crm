import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { listLeads, updateLead, getPool } from "@/lib/db";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!getPool()) return NextResponse.json({ leads: [], dbReady: false });
  const leads = await listLeads();
  return NextResponse.json({ leads, dbReady: true });
}

export async function PATCH(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: number; status?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await updateLead(body.id, {
    ...(typeof body.status === "string" ? { status: body.status } : {}),
    ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
  });
  return NextResponse.json({ ok: true });
}
