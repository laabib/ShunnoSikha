"use client";

import React, { useState } from "react";
import { BrainCircuit, RefreshCw, Code2, ShieldAlert, Users, GitBranch, Info } from "lucide-react";
import { Panel, Badge, Loading } from "../ui";
import { fireApi, SEVERITY_COLORS } from "@/lib/fire";
import { useSensors } from "@/lib/sensors";

export default function AIIntelligence({ state }: { state: any }) {
  const { snapshot, refresh } = useSensors();
  const [manualAssessment, setManualAssessment] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState(false);
  const [err, setErr] = useState("");

  // Prefer live auto-refreshed assessment from SensorDataService, or latest manual refresh
  const a =
    manualAssessment && manualAssessment.assessed_revision >= (snapshot?.ai_assessment?.assessed_revision ?? 0)
      ? manualAssessment
      : snapshot?.ai_assessment || manualAssessment;

  const isLive = snapshot?.mode === "live" || state?.data_source === "LIVE_HARDWARE";

  const run = () => {
    setBusy(true);
    setErr("");
    fireApi
      .aiAssessment()
      .then((res) => {
        setManualAssessment(res);
        void refresh();
      })
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  };

  const sourceLabel = a?.data_source || (isLive ? "LIVE_HARDWARE" : "SIMULATION");

  return (
    <div className="space-y-4">
      <Panel
        title="AI Emergency Intelligence"
        icon={<BrainCircuit className="h-4 w-4" />}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={isLive ? "#22d3ee" : "#fbbf24"}>
              {isLive ? "LIVE HARDWARE INPUT" : "SYNTHETIC / SIMULATED INPUT"}
            </Badge>
            <button type="button" onClick={() => setRaw((r) => !r)} className="btn !px-2.5 !py-1 text-[11px]">
              <Code2 className="h-3.5 w-3.5" /> {raw ? "Cards" : "JSON"}
            </button>
            <button type="button" onClick={run} disabled={busy} className="btn btn-primary !py-1 text-[11px]">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh Assessment
            </button>
          </div>
        }
      >
        <p className="text-xs text-mist-400">
          Consumes the unified central state (fire classification, spread, O₂/CO/CO₂, temperature, smoke, pressure, and crew threshold status). Automatically refreshes on meaningful state transitions (rate-limited at 20s) without spamming the LLM on tiny fluctuations.
        </p>
        {err && <div className="mt-2 rounded-lg border border-flame-500/50 bg-flame-500/10 px-3 py-2 text-xs text-flame-400">{err}</div>}
      </Panel>

      {busy && <Loading label="Generating emergency assessment" />}

      {a && !busy &&
        (raw ? (
          <Panel title="Structured JSON Assessment" icon={<Code2 className="h-4 w-4" />}>
            <pre className="max-h-[480px] overflow-auto rounded-lg border border-line bg-void-950 p-4 font-mono text-[11px] leading-relaxed text-ion-300">
              {JSON.stringify(a, null, 2)}
            </pre>
          </Panel>
        ) : (
          <div className="stagger grid gap-4 lg:grid-cols-2">
            <Panel
              title="Situation Summary"
              icon={<Info className="h-4 w-4" />}
              className="lg:col-span-2"
              right={<Badge color={a.mode?.includes("LLM") ? "#4ade80" : "#fbbf24"}>{a.mode}</Badge>}
            >
              <p className="text-sm leading-relaxed text-mist-200">{a.situation_summary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge color={SEVERITY_COLORS[a.fire_severity] || "#fbbf24"}>Severity: {a.fire_severity}</Badge>
                <Badge color={sourceLabel === "LIVE_HARDWARE" ? "#22d3ee" : "#fbbf24"}>Source: {sourceLabel}</Badge>
                {a.assessed_at && <Badge color="#8b99b5">Assessed: {String(a.assessed_at).split("T")[1]?.slice(0, 8)}Z</Badge>}
              </div>
            </Panel>
            <Panel title="Environmental Risk" icon={<ShieldAlert className="h-4 w-4" />}>
              <p className="text-sm leading-relaxed text-mist-300">{a.environmental_risk}</p>
            </Panel>
            <Panel title="Potential Spread Scenario" icon={<GitBranch className="h-4 w-4" />}>
              <p className="text-sm leading-relaxed text-mist-300">{a.spread_scenario}</p>
            </Panel>
            <Panel title="Recommended Emergency Response" icon={<ShieldAlert className="h-4 w-4" />}>
              <ul className="space-y-1.5">
                {(a.recommended_response || []).map((r: string, i: number) => (
                  <li key={i} className="flex gap-2 text-xs text-mist-300">
                    <span className="text-ember-400">▸</span>
                    {r}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Crew Safety Recommendations" icon={<Users className="h-4 w-4" />}>
              <ul className="space-y-1.5">
                {(a.crew_recommendations || []).map((r: string, i: number) => (
                  <li key={i} className="flex gap-2 text-xs text-mist-300">
                    <span className="text-pulse-400">▸</span>
                    {r}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Rationale & Provenance" icon={<Info className="h-4 w-4" />} className="lg:col-span-2">
              <p className="text-xs leading-relaxed text-mist-400">{a.rationale}</p>
            </Panel>
          </div>
        ))}

      {!a && !busy && (
        <div className="panel flex flex-col items-center gap-3 py-12 text-center">
          <BrainCircuit className="h-10 w-10 text-nova-400" />
          <div className="text-sm text-mist-300">Awaiting automatic threshold assessment</div>
          <p className="max-w-md text-xs text-mist-500">
            Click &quot;Refresh Assessment&quot; or trigger a fire/sensor change to generate an emergency assessment from the centralized state.
          </p>
        </div>
      )}
    </div>
  );
}
