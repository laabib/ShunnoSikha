"use client";

import React, { useMemo, useState } from "react";
import { ScrollText, Download, FileJson, Filter } from "lucide-react";
import { Panel, Badge, Empty } from "../ui";
import { fireApi, downloadText } from "@/lib/fire";

const SEV_COLOR: Record<string, string> = { info: "#22d3ee", warning: "#fbbf24", critical: "#ef4444" };

export default function EmergencyHistory({ state }: { state: any }) {
  const [typeFilter, setTypeFilter] = useState("");
  const [sevFilter, setSevFilter] = useState("");
  const [busy, setBusy] = useState("");
  const events = state?.events || [];
  const source = state?.data_source || "SIMULATION";
  const types = useMemo(() => Array.from(new Set(events.map((e: any) => e.type))), [events]);

  const filtered = events.filter((e: any) => (!typeFilter || e.type === typeFilter) && (!sevFilter || e.severity === sevFilter));

  const download = async (fmt: "md" | "json") => {
    setBusy(fmt);
    try {
      const rep = await fireApi.report(fmt);
      if (fmt === "md") downloadText(rep.filename || "fire_incident_report.md", rep.markdown, "text/markdown");
      else downloadText("fire_incident_report.json", JSON.stringify(rep, null, 2), "application/json");
    } catch {
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Emergency Incident Report"
        icon={<Download className="h-4 w-4" />}
        right={
          <div className="flex gap-2">
            <button type="button" onClick={() => download("md")} disabled={!!busy} className="btn btn-primary !py-1 text-[11px]">
              <Download className="h-3.5 w-3.5" /> {busy === "md" ? "Building…" : "Download .md"}
            </button>
            <button type="button" onClick={() => download("json")} disabled={!!busy} className="btn btn-ion !py-1 text-[11px]">
              <FileJson className="h-3.5 w-3.5" /> {busy === "json" ? "Building…" : "Download .json"}
            </button>
          </div>
        }
      >
        <p className="text-xs text-mist-400">
          Report includes incident overview, fire classification, spread timeline, environmental changes, suppression actions, crew survival assessment, and AI recommendations — explicitly labeled{" "}
          <span className="font-mono text-mist-200">{source}</span>.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-line bg-void-900 px-2.5 py-1.5 text-[11px]">
            <span className="text-mist-500">Events: </span>
            <span className="metric-num text-ion-400">{events.length}</span>
          </div>
          <div className="rounded-md border border-line bg-void-900 px-2.5 py-1.5 text-[11px]">
            <span className="text-mist-500">Sim time: </span>
            <span className="metric-num text-ember-400">{state?.sim_time != null ? `${state.sim_time}s` : "—"}</span>
          </div>
          <div className="rounded-md border border-line bg-void-900 px-2.5 py-1.5 text-[11px]">
            <span className="text-mist-500">Status: </span>
            <span className="metric-num text-mist-200">{state?.status}</span>
          </div>
          <div className="rounded-md border border-line bg-void-900 px-2.5 py-1.5 text-[11px]">
            <span className="text-mist-500">Source: </span>
            <span className={`metric-num ${source === "LIVE_HARDWARE" ? "text-cyan-400" : "text-amber-400"}`}>{source}</span>
          </div>
        </div>
      </Panel>

      <Panel
        title="Emergency Event Timeline"
        icon={<ScrollText className="h-4 w-4" />}
        right={
          <div className="flex gap-1.5">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-line bg-void-900 px-2 py-1 text-[10px] text-mist-300"
            >
              <option value="">All types</option>
              {types.map((t: any) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={sevFilter}
              onChange={(e) => setSevFilter(e.target.value)}
              className="rounded-md border border-line bg-void-900 px-2 py-1 text-[10px] text-mist-300"
            >
              <option value="">All severity</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <Empty icon={<Filter className="h-8 w-8" />} title="No matching events" sub="Run a simulation or stream hardware packets to record events." />
        ) : (
          <div className="max-h-[440px] overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-void-800 text-mist-400">
                <tr>
                  <th className="px-2.5 py-2">t (s)</th>
                  <th className="px-2.5 py-2">Type</th>
                  <th className="px-2.5 py-2">Severity</th>
                  <th className="px-2.5 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .reverse()
                  .map((e: any, i: number) => (
                    <tr key={i} className="border-t border-line/60 hover:bg-void-700/40">
                      <td className="metric-num px-2.5 py-1.5 text-mist-500">{e.t}</td>
                      <td className="metric-num px-2.5 py-1.5 text-ion-300">{e.type}</td>
                      <td className="px-2.5 py-1.5">
                        <Badge color={SEV_COLOR[e.severity] || "#8b99b5"}>{e.severity}</Badge>
                      </td>
                      <td className="px-2.5 py-1.5 text-mist-300">{e.message}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
