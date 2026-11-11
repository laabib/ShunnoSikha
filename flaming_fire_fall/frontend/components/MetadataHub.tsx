"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Database, Filter, AlertTriangle, Target, Search, ArrowUpDown } from "lucide-react";
import { api } from "@/lib/api";
import { Panel, Stat, Badge, Loading, Slider, Empty } from "./ui";

const MATERIALS = ["PMMA", "Nomex", "Cotton-Fiber Blend"];

// Tolerate array, comma-joined string, or null payloads from the API.
function normalizeFlags(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export default function MetadataHub() {
  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [invest, setInvest] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("test_id");
  const [loading, setLoading] = useState(true);
  // ranker
  const [rO2, setRO2] = useState(34);
  const [rFlow, setRFlow] = useState(5);
  const [rP, setRP] = useState(8.2);
  const [rMat, setRMat] = useState("Nomex");
  const [ranked, setRanked] = useState<any[]>([]);
  const [ranking, setRanking] = useState(false);

  useEffect(() => {
    Promise.all([api.metadataSummary(), api.metadataRecords(), api.metadataAnomalies()])
      .then(([s, r, a]) => { setSummary(s); setRecords(r.records); setAnomalies(a.anomalies); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let rows = records;
    if (invest) rows = rows.filter((r) => r.investigation_id === invest);
    if (search) rows = rows.filter((r) => `${r.test_id} ${r.sample_material} ${r.flammability_status}`.toLowerCase().includes(search.toLowerCase()));
    return [...rows].sort((a, b) => String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), undefined, { numeric: true }));
  }, [records, invest, search, sortKey]);

  const runRank = async () => {
    setRanking(true);
    try { const d = await api.rank({ o2_pct: rO2, flow_cms: rFlow, pressure_psi: rP, material: rMat, top_k: 6 }); setRanked(d.ranked_experiments); }
    catch {} finally { setRanking(false); }
  };

  const investigations = summary?.investigations_covered || [];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Harmonized Flight Tests" value={summary.total_harmonized_tests} accent="#f59e0b" />
          <Stat label="Investigations" value={investigations.length} accent="#22d3ee" sub={investigations.join(" · ")} />
          <Stat label="Materials Cataloged" value={summary.materials_cataloged?.length} accent="#e879f9" />
          <Stat label="Sensor Anomalies Fixed" value={summary.anomalies_detected} accent="#4ade80" />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Panel title="Physics-Weighted Ranker" icon={<Target className="h-4 w-4" />} className="h-fit">
          <div className="space-y-4">
            <div>
              <span className="label">Target Material</span>
              <select value={rMat} onChange={(e) => setRMat(e.target.value)} className="input">{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select>
            </div>
            <Slider label="Target O₂" value={rO2} min={13} max={35} step={0.1} unit="%" onChange={setRO2} color="#22d3ee" />
            <Slider label="Target Airflow" value={rFlow} min={0.5} max={24} step={0.1} unit="cm/s" onChange={setRFlow} color="#4ade80" />
            <Slider label="Target Pressure" value={rP} min={8} max={14.7} step={0.1} unit="psi" onChange={setRP} color="#60a5fa" />
            <button onClick={runRank} disabled={ranking} className="btn btn-primary w-full"><Target className="h-4 w-4" /> {ranking ? "Ranking…" : "Rank Matching NASA Tests"}</button>
          </div>
          {ranked.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-line pt-3">
              {ranked.map((r, i) => (
                <div key={i} className="rounded-lg border border-line bg-void-900/60 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="metric-num text-xs font-bold text-ember-400">#{i + 1} {r.test_id}</span>
                    <span className="metric-num text-xs font-semibold text-pulse-400">{r.similarity_pct}%</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-mist-500">{r.investigation_id} · {r.sample_material} · {r.pre_O2_pct}% O₂ · {r.fan_display_velocity_cms} cm/s</div>
                  <div className="mt-1 h-1 overflow-hidden rounded bg-void-800"><div className="h-full bg-gradient-to-r from-ember-600 to-pulse-500" style={{ width: `${r.similarity_pct}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Unified PSI Flight Matrix" icon={<Database className="h-4 w-4" />}
            right={<span className="metric-num text-[10px] text-mist-500">{filtered.length} records</span>}>
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter tests…" className="input !py-1.5 !pl-8 text-xs" />
              </div>
              <select value={invest} onChange={(e) => setInvest(e.target.value)} className="input !w-auto !py-1.5 text-xs">
                <option value="">All Investigations</option>
                {investigations.map((i: string) => <option key={i}>{i}</option>)}
              </select>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="input !w-auto !py-1.5 text-xs">
                <option value="test_id">Sort: Test ID</option>
                <option value="pre_O2_pct">Sort: O₂ %</option>
                <option value="fan_display_velocity_cms">Sort: Airflow</option>
                <option value="sample_material">Sort: Material</option>
              </select>
            </div>
            {loading ? <Loading /> : (
              <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-void-800 text-mist-400">
                    <tr>{["Test", "Investigation", "Material", "O₂ %", "Flow cm/s", "P psi", "Status", "Flags"].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2 font-semibold uppercase tracking-wide">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={i} className="border-t border-line/60 hover:bg-void-700/40">
                        <td className="metric-num whitespace-nowrap px-2.5 py-1.5 font-semibold text-ember-400">{r.test_id}</td>
                        <td className="px-2.5 py-1.5 text-mist-400">{r.investigation_id}</td>
                        <td className="px-2.5 py-1.5 text-mist-200">{r.sample_material}</td>
                        <td className="metric-num px-2.5 py-1.5 text-ion-300">{r.pre_O2_pct}</td>
                        <td className="metric-num px-2.5 py-1.5 text-pulse-400">{r.fan_display_velocity_cms}</td>
                        <td className="metric-num px-2.5 py-1.5 text-volt-400">{r.cabin_pressure_psi}</td>
                        <td className="whitespace-nowrap px-2.5 py-1.5 text-mist-300">{r.flammability_status}</td>
                        <td className="px-2.5 py-1.5">{normalizeFlags(r.anomaly_flags).filter((f: string) => f !== "NOMINAL").map((f: string) => <Badge key={f} color="#fbbf24">{f}</Badge>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Automated Sensor Anomaly Filter" icon={<AlertTriangle className="h-4 w-4" />}>
            {anomalies.length === 0 ? <Empty title="No anomalies" /> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {anomalies.map((a, i) => (
                  <div key={i} className="rounded-lg border border-ember-500/30 bg-ember-500/5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge color={a.severity === "CRITICAL" ? "#ef4444" : a.severity === "WARNING" ? "#f97316" : "#fbbf24"}>{a.severity}</Badge>
                      <span className="metric-num text-xs font-bold text-mist-200">{a.test_id}</span>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-ember-300">{a.rule}</div>
                    <p className="mt-0.5 text-[10px] leading-snug text-mist-400">{a.detail}</p>
                    <div className="mt-1 text-[10px] text-pulse-400">→ {a.action_taken}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}