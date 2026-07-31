import { NextRequest, NextResponse } from "next/server";
import { recordEvent, eventReport, clearEvents } from "@/lib/db";

// Lightweight site-event tracker. Client sites forward events here (server-side,
// with the shared INGEST_TOKEN). POST records one event; GET returns a report.
function authed(req: NextRequest): boolean {
  const token = req.headers.get("x-ingest-token") || new URL(req.url).searchParams.get("token") || "";
  return !!process.env.INGEST_TOKEN && token === process.env.INGEST_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ ok: false }, { status: 401 });
  let body: { source?: string; type?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const source = (body.source || "").trim();
  const type = (body.type || "").trim();
  if (!source || !type) return NextResponse.json({ ok: false, error: "missing source/type" }, { status: 400 });
  try {
    await recordEvent(source, type);
  } catch {
    return NextResponse.json({ ok: false, error: "store failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "affordable-auto-glass";
  const days = Math.min(366, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10)));
  const rows = await eventReport(source, days);
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.type] = r.n;
  return NextResponse.json({ ok: true, source, days, counts });
}

// Admin: clear all events for a source (used to wipe test data). Token required.
export async function DELETE(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const source = new URL(req.url).searchParams.get("source");
  if (!source) return NextResponse.json({ ok: false, error: "source required" }, { status: 400 });
  const n = await clearEvents(source);
  return NextResponse.json({ ok: true, cleared: n });
}
