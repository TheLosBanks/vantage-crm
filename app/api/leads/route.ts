import { NextResponse } from "next/server";
import { isAuthed, currentUser } from "@/lib/auth";
import { listLeads, updateLead, upsertLead, getPool } from "@/lib/db";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!getPool()) return NextResponse.json({ leads: [], dbReady: false });
  const leads = await listLeads();
  return NextResponse.json({ leads, dbReady: true });
}

export async function PATCH(request: Request) {
  const who = await currentUser();
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: number; status?: string; notes?: string; script?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await updateLead(
    body.id,
    {
      ...(typeof body.status === "string" ? { status: body.status } : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
      ...(typeof body.script === "string" ? { script: body.script } : {}),
    },
    who,
  );
  return NextResponse.json({ ok: true });
}

// Manual add lead (walk-in / phone leads that don't come through the email pipeline).
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!getPool()) return NextResponse.json({ error: "no database" }, { status: 503 });
  let body: { name?: string; category?: string; phone?: string; email?: string; website?: string; script?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.name || !body.name.trim()) return NextResponse.json({ error: "missing name" }, { status: 400 });
  await upsertLead({
    name: body.name.trim(), category: body.category || "", phone: body.phone || "",
    email: body.email || "", instagram: "", linkedin: "", website: body.website || "",
    script: body.script || "",
  });
  return NextResponse.json({ ok: true });
}
