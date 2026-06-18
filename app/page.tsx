"use client";

import { useEffect, useMemo, useState } from "react";

const STATUSES = ["New", "Drafted", "Sent", "Replied", "Booked", "Closed"];
const STATUS_COLOR: Record<string, string> = {
  New: "bg-slate-100 text-slate-700",
  Drafted: "bg-amber-100 text-amber-800",
  Sent: "bg-blue-100 text-blue-800",
  Replied: "bg-violet-100 text-violet-800",
  Booked: "bg-green-100 text-green-800",
  Closed: "bg-slate-200 text-slate-500",
};

type Lead = {
  id: number; name: string; category: string; phone: string; email: string;
  instagram: string; linkedin: string; website: string; status: string; notes: string;
};

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function load() {
    const r = await fetch("/api/leads");
    if (r.status === 401) { setAuthed(false); return; }
    const d = await r.json();
    setAuthed(true);
    setDbReady(d.dbReady !== false);
    setLeads(d.leads || []);
  }
  useEffect(() => { load(); }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (!r.ok) { setErr("Wrong password"); return; }
    setPw(""); load();
  }

  async function patch(id: number, fields: Partial<Lead>) {
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, ...fields } : l)));
    await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...fields }) });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) =>
      (statusFilter === "All" || l.status === statusFilter) &&
      (!term || [l.name, l.category, l.email, l.phone].some((v) => (v || "").toLowerCase().includes(term)))
    );
  }, [leads, q, statusFilter]);

  if (authed === null) return <main className="grid min-h-screen place-items-center text-slate-400">Loading…</main>;

  if (!authed) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">Vantage Works CRM</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your password.</p>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password"
            className="mt-5 w-full rounded-lg border border-slate-300 px-3.5 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
          {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
          <button className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Vantage Works CRM</h1>
          <p className="text-sm text-slate-500">{leads.length} leads</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "All" : s)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusFilter === s ? "ring-2 ring-slate-900" : ""} ${STATUS_COLOR[s]}`}>
              {s} {counts[s] || 0}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone…"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-slate-900" />
        {statusFilter !== "All" && (
          <button onClick={() => setStatusFilter("All")} className="text-sm font-semibold text-slate-600 underline">Clear filter</button>
        )}
      </div>

      {!dbReady && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Database not connected yet. Add a Postgres store to this project in Vercel (Storage tab), then the leads will load here.
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Socials</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 min-w-[200px]">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((l) => (
              <tr key={l.id} className="align-top hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.category}</div>
                  {l.website && <a href={l.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">site →</a>}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {l.email && <div><a href={`mailto:${l.email}`} className="hover:underline">{l.email}</a></div>}
                  {l.phone && <div className="text-slate-500">{l.phone}</div>}
                </td>
                <td className="px-4 py-3 text-xs">
                  {l.instagram && <a href={l.instagram} target="_blank" rel="noreferrer" className="block text-pink-600 hover:underline">Instagram</a>}
                  {l.linkedin && <a href={l.linkedin} target="_blank" rel="noreferrer" className="block text-blue-700 hover:underline">LinkedIn</a>}
                  {!l.instagram && !l.linkedin && <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <select value={l.status} onChange={(e) => patch(l.id, { status: e.target.value })}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-bold outline-none ${STATUS_COLOR[l.status] || "bg-slate-100"}`}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <textarea defaultValue={l.notes} onBlur={(e) => { if (e.target.value !== l.notes) patch(l.id, { notes: e.target.value }); }}
                    rows={1} placeholder="Add a note…"
                    className="w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none" />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No leads match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
