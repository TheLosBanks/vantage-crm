"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

const STATUSES = ["New", "Drafted", "Sent", "Replied", "Booked", "Closed"];
const STATUS_COLOR: Record<string, string> = {
  New: "bg-slate-500/20 text-slate-200",
  Drafted: "bg-amber-500/20 text-amber-300",
  Sent: "bg-sky-500/20 text-sky-300",
  Replied: "bg-violet-500/20 text-violet-300",
  Booked: "bg-emerald-500/20 text-emerald-300",
  Closed: "bg-slate-600/20 text-slate-400",
};

type Lead = {
  id: number; name: string; category: string; phone: string; email: string;
  instagram: string; linkedin: string; website: string; status: string; notes: string; script: string;
};

const EMPTY_ADD = { name: "", category: "", phone: "", website: "", script: "" };

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [adding, setAdding] = useState(false);

  function toggleExpand(id: number) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copyScript(id: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard blocked; ignore */
    }
  }

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || adding) return;
    setAdding(true);
    const r = await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addForm),
    });
    setAdding(false);
    if (r.ok) { setAddForm(EMPTY_ADD); setShowAdd(false); load(); }
  }

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
      (!term || [l.name, l.category, l.email, l.phone, l.script].some((v) => (v || "").toLowerCase().includes(term)))
    );
  }, [leads, q, statusFilter]);

  if (authed === null) return <main className="grid min-h-screen place-items-center text-vw-muted">Loading…</main>;

  if (!authed) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-vw-line bg-vw-panel p-8">
          <div className="text-xl font-extrabold">
            <span className="bg-gradient-to-r from-vw-accent to-vw-accent2 bg-clip-text text-transparent">Vantage Works</span> CRM
          </div>
          <p className="mt-1 text-sm text-vw-muted">Enter your password.</p>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password"
            className="mt-5 w-full rounded-lg border border-vw-line bg-vw-bg px-3.5 py-3 text-vw-text outline-none focus:border-vw-accent" />
          {err && <p className="mt-2 text-sm font-semibold text-red-400">{err}</p>}
          <button className="mt-4 w-full rounded-lg bg-vw-accent px-4 py-3 font-bold text-white transition hover:opacity-90">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">
            <span className="bg-gradient-to-r from-vw-accent to-vw-accent2 bg-clip-text text-transparent">Vantage Works</span>
            <span className="text-vw-text"> CRM</span>
          </h1>
          <p className="text-sm text-vw-muted">{leads.length} leads</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "All" : s)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${statusFilter === s ? "ring-2 ring-vw-accent" : ""} ${STATUS_COLOR[s]}`}>
              {s} {counts[s] || 0}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, script…"
          className="w-full max-w-xs rounded-lg border border-vw-line bg-vw-panel px-3.5 py-2.5 text-sm text-vw-text outline-none placeholder:text-vw-muted focus:border-vw-accent" />
        {statusFilter !== "All" && (
          <button onClick={() => setStatusFilter("All")} className="text-sm font-semibold text-vw-accent hover:underline">Clear filter</button>
        )}
        <button onClick={() => setShowAdd((s) => !s)}
          className="ml-auto rounded-lg bg-vw-accent px-3.5 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
          {showAdd ? "Close" : "+ Add lead"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addLead} className="mt-3 grid gap-3 rounded-xl border border-vw-line bg-vw-panel p-4 sm:grid-cols-2">
          <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Business name *"
            className="rounded-lg border border-vw-line bg-vw-bg px-3 py-2.5 text-sm text-vw-text outline-none placeholder:text-vw-muted focus:border-vw-accent" />
          <input value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} placeholder="Category (e.g. restaurant)"
            className="rounded-lg border border-vw-line bg-vw-bg px-3 py-2.5 text-sm text-vw-text outline-none placeholder:text-vw-muted focus:border-vw-accent" />
          <input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="Phone"
            className="rounded-lg border border-vw-line bg-vw-bg px-3 py-2.5 text-sm text-vw-text outline-none placeholder:text-vw-muted focus:border-vw-accent" />
          <input value={addForm.website} onChange={(e) => setAddForm({ ...addForm, website: e.target.value })} placeholder="Website (if any)"
            className="rounded-lg border border-vw-line bg-vw-bg px-3 py-2.5 text-sm text-vw-text outline-none placeholder:text-vw-muted focus:border-vw-accent" />
          <textarea value={addForm.script} onChange={(e) => setAddForm({ ...addForm, script: e.target.value })} placeholder="Call / walk-in script" rows={4}
            className="resize-y rounded-lg border border-vw-line bg-vw-bg px-3 py-2.5 text-sm text-vw-text outline-none placeholder:text-vw-muted focus:border-vw-accent sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={!addForm.name.trim() || adding}
              className="rounded-lg bg-vw-accent px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40">
              {adding ? "Adding…" : "Add lead"}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setAddForm(EMPTY_ADD); }}
              className="rounded-lg border border-vw-line px-4 py-2.5 text-sm font-semibold text-vw-muted transition hover:text-vw-text">Cancel</button>
          </div>
        </form>
      )}

      {!dbReady && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-300">
          Database not connected yet. Add a Postgres store to this project in Vercel (Storage tab), then the leads will load here.
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-vw-line bg-vw-panel">
        <table className="w-full text-sm">
          <thead className="border-b border-vw-line text-left text-xs uppercase tracking-wide text-vw-muted">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Socials</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Script</th>
              <th className="px-4 py-3 min-w-[200px]">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vw-line">
            {filtered.map((l) => (
              <Fragment key={l.id}>
              <tr className="align-top transition hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <div className="font-semibold text-vw-text">{l.name}</div>
                  <div className="text-xs text-vw-muted">{l.category}</div>
                  {l.website && <a href={l.website} target="_blank" rel="noreferrer" className="text-xs text-vw-accent hover:underline">site →</a>}
                </td>
                <td className="px-4 py-3 text-vw-text/80">
                  {l.email && <div><a href={`mailto:${l.email}`} className="hover:text-vw-accent">{l.email}</a></div>}
                  {l.phone && <div><a href={`tel:${l.phone.replace(/[^+\d]/g, "")}`} className="text-vw-muted hover:text-vw-accent">{l.phone}</a></div>}
                </td>
                <td className="px-4 py-3 text-xs">
                  {l.instagram && <a href={l.instagram} target="_blank" rel="noreferrer" className="block text-pink-400 hover:underline">Instagram</a>}
                  {l.linkedin && <a href={l.linkedin} target="_blank" rel="noreferrer" className="block text-sky-400 hover:underline">LinkedIn</a>}
                  {!l.instagram && !l.linkedin && <span className="text-vw-muted/50">—</span>}
                </td>
                <td className="px-4 py-3">
                  <select value={l.status} onChange={(e) => patch(l.id, { status: e.target.value })}
                    className={`rounded-md border-0 px-2.5 py-1.5 text-xs font-bold outline-none ${STATUS_COLOR[l.status] || "bg-slate-500/20 text-slate-200"}`}>
                    {STATUSES.map((s) => <option key={s} value={s} className="bg-vw-panel text-vw-text">{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleExpand(l.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${l.script ? "bg-vw-accent/20 text-vw-accent hover:bg-vw-accent/30" : "text-vw-muted hover:text-vw-text"}`}>
                    {l.script ? (expanded.has(l.id) ? "Hide script" : "Script") : (expanded.has(l.id) ? "Hide" : "+ Script")}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <textarea defaultValue={l.notes} onBlur={(e) => { if (e.target.value !== l.notes) patch(l.id, { notes: e.target.value }); }}
                    rows={1} placeholder="Add a note…"
                    className="w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-vw-text placeholder:text-vw-muted hover:border-vw-line focus:border-vw-accent focus:bg-vw-bg focus:outline-none" />
                </td>
              </tr>
              {expanded.has(l.id) && (
                <tr className="bg-vw-bg/40">
                  <td colSpan={6} className="px-4 pb-4">
                    <div className="rounded-lg border border-vw-line bg-vw-bg p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-vw-muted">Call / walk-in script</span>
                        <button onClick={() => copyScript(l.id, l.script)} disabled={!l.script}
                          className="rounded-md bg-vw-accent px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40">
                          {copiedId === l.id ? "Copied ✓" : "Copy"}
                        </button>
                      </div>
                      <textarea defaultValue={l.script} onBlur={(e) => { if (e.target.value !== l.script) patch(l.id, { script: e.target.value }); }}
                        rows={5} placeholder="Paste the call or walk-in script here…"
                        className="w-full resize-y rounded-md border border-vw-line bg-vw-panel px-3 py-2 text-sm leading-relaxed text-vw-text placeholder:text-vw-muted focus:border-vw-accent focus:outline-none" />
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-vw-muted">No leads match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
