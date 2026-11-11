"use client";

import React, { useEffect, useState } from "react";
import { Search, Globe, BookOpen, ExternalLink, Satellite, MessageSquareQuote, Database } from "lucide-react";
import { api } from "@/lib/api";
import { Panel, Badge, Loading, Markdown, Empty } from "./ui";

const SOURCE_META: Record<string, { label: string; color: string }> = {
  PSI_LIVE_API: { label: "NASA PSI · LIVE", color: "#4ade80" },
  NTRS_LIVE_API: { label: "NTRS · LIVE", color: "#22d3ee" },
  NASA_LIVE_PAGE: { label: "NASA.GOV · LIVE", color: "#f59e0b" },
};

const SAMPLES = [
  "BASS-II limiting oxygen concentration microgravity",
  "Saffire large scale spacecraft fire Cygnus",
  "FLEX cool flame droplet extinction",
  "radiative extinction low flow flammability boundary",
];

export default function NasaRag() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"search" | "ask">("ask");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => { api.ragStatus().then(setStatus).catch(() => {}); }, []);

  const run = async (q: string) => {
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true); setData(null);
    try {
      const d = mode === "ask" ? await api.ragAsk({ query, top_k: 6 }) : await api.ragLive({ query, top_k: 8 });
      setData(d);
      api.ragStatus().then(setStatus).catch(() => {});
    } catch (e: any) {
      setData({ error: e.message });
    } finally { setBusy(false); }
  };

  const retrieval = data?.retrieval || data;
  const passages = retrieval?.passages || [];

  return (
    <div className="space-y-4">
      <Panel title="Live NASA Retrieval-Augmented Generation" icon={<Globe className="h-4 w-4" />}
        right={<Badge color="#4ade80" pulse>NO PAPER DOWNLOADS</Badge>}>
        <p className="mb-3 text-xs text-mist-400">
          Queries fetch <span className="text-pulse-400">live</span> from the NASA PSI repository API, the NTRS citation search API,
          and NASA Glenn pages — chunked, ranked, and cited on demand. Every passage carries its source URL and fetch timestamp.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(query)}
              placeholder="Search NASA microgravity combustion science…" className="input !pl-9" />
          </div>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {(["ask", "search"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 text-xs font-semibold transition-colors ${mode === m ? "bg-ember-500/20 text-ember-300" : "bg-void-900 text-mist-500 hover:text-mist-300"}`}>
                {m === "ask" ? "Ask AI" : "Passages"}
              </button>
            ))}
          </div>
          <button onClick={() => run(query)} disabled={busy} className="btn btn-primary"><Satellite className="h-4 w-4" /> {busy ? "Fetching…" : "Retrieve"}</button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SAMPLES.map((s) => <button key={s} onClick={() => { setQuery(s); run(s); }} className="chip hover:!border-ion-500/50 hover:!text-ion-300">{s}</button>)}
        </div>
      </Panel>

      {busy && <Loading label="Fetching live NASA sources + ranking passages" />}

      {data?.error && <div className="panel border-flame-500/40 p-4 text-sm text-flame-400">Retrieval error: {data.error}</div>}

      {!busy && data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {mode === "ask" && data.answer_markdown && (
              <Panel title="Grounded Scientific Answer" icon={<MessageSquareQuote className="h-4 w-4" />} right={<Badge color="#e879f9">LLM SYNTHESIS</Badge>}>
                <Markdown>{data.answer_markdown}</Markdown>
              </Panel>
            )}
            <Panel title={`Ranked Passages · ${passages.length}`} icon={<BookOpen className="h-4 w-4" />}>
              {passages.length === 0 ? <Empty title="No passages retrieved" sub="Try a broader query or check network access to NASA servers." /> : (
                <div className="space-y-3">
                  {passages.map((p: any, i: number) => {
                    const sm = SOURCE_META[p.source_type] || { label: p.source_type, color: "#8b99b5" };
                    return (
                      <div key={i} className="rounded-lg border border-line bg-void-900/60 p-3 transition-colors hover:border-line-bright">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <Badge color={sm.color}>{sm.label}</Badge>
                          <span className="metric-num text-[10px] text-mist-600">score {p.score}</span>
                          <span className="text-[10px] text-mist-600">fetched {p.fetched_at_iso}</span>
                        </div>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-1.5 text-sm font-semibold text-ion-300 hover:text-ion-400">
                          <span className="flex-1">{p.title}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
                        </a>
                        <p className="mt-1.5 text-xs leading-relaxed text-mist-400">{p.text?.slice(0, 420)}{p.text?.length > 420 ? "…" : ""}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            {retrieval?.psi_investigations?.length > 0 && (
              <Panel title="PSI Investigations" icon={<Database className="h-4 w-4" />}>
                <div className="space-y-1.5">
                  {retrieval.psi_investigations.map((p: any) => (
                    <a key={p.accession} href={p.url} target="_blank" rel="noopener noreferrer"
                      className="block rounded-lg border border-line bg-void-900/60 px-3 py-2 hover:border-pulse-500/50">
                      <span className="metric-num text-xs font-bold text-pulse-400">{p.accession}</span>
                      <p className="mt-0.5 text-[11px] leading-snug text-mist-400">{p.title}</p>
                    </a>
                  ))}
                </div>
              </Panel>
            )}
            {retrieval?.ntrs_citations?.length > 0 && (
              <Panel title="NTRS Citations" icon={<BookOpen className="h-4 w-4" />}>
                <div className="space-y-2">
                  {retrieval.ntrs_citations.map((c: any) => (
                    <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-line bg-void-900/60 px-3 py-2 hover:border-ion-500/50">
                      <div className="metric-num text-[10px] text-ion-400">{c.id}</div>
                      <p className="mt-0.5 text-[11px] font-medium leading-snug text-mist-200">{c.title}</p>
                      {c.authors?.length > 0 && <p className="mt-0.5 text-[10px] text-mist-500">{c.authors.slice(0, 2).join(", ")}</p>}
                    </a>
                  ))}
                </div>
              </Panel>
            )}
            {status && (
              <Panel title="Retrieval Engine" icon={<Globe className="h-4 w-4" />}>
                <div className="space-y-1.5 text-[11px] text-mist-400">
                  <div className="flex justify-between"><span>Indexed passages</span><span className="metric-num text-ion-400">{status.indexed_passages}</span></div>
                  <div className="flex justify-between"><span>Live URLs fetched</span><span className="metric-num text-pulse-400">{status.indexed_urls}</span></div>
                  <div className="flex justify-between"><span>Mode</span><span className="metric-num text-ember-400">{status.mode}</span></div>
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}

      {!data && !busy && (
        <Empty icon={<Globe className="h-10 w-10" />} title="Query NASA's live science archives"
          sub="Retrieval runs directly against psi.nasa.gov, the NTRS API, and NASA Glenn research pages. No PDFs are downloaded — passages are fetched, ranked, and cited in real time." />
      )}
    </div>
  );
}