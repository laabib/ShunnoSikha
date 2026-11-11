"use client";

import React, { useEffect, useState } from "react";
import { Lightbulb, FlaskConical, Telescope, CheckCircle2, Satellite } from "lucide-react";
import { api, REGIME_COLORS } from "@/lib/api";
import { Panel, Badge, Loading, Markdown, Stat } from "./ui";

export default function HypothesisLab() {
  const [voids, setVoids] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [protocol, setProtocol] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.voids().then((d) => { setVoids(d.voids); if (d.voids[0]) design(d.voids[0].void_id); }).catch(() => {}); }, []);

  const design = async (id: string) => {
    setSelected(id); setLoading(true);
    try { setProtocol(await api.designHypothesis(id)); } catch {} finally { setLoading(false); }
  };

  const pred = protocol?.digital_twin_prediction;
  const cfg = protocol?.recommended_flight_test_configuration;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Panel title="Detected Parameter Voids" icon={<Telescope className="h-4 w-4" />} className="h-fit">
        <p className="mb-3 text-[11px] leading-relaxed text-mist-500">
          Gaps in the historical NASA test matrix where exploration-atmosphere conditions remain uncharacterized.
          Select a void to auto-design a testable flight experiment.
        </p>
        <div className="space-y-2">
          {voids.map((v) => (
            <button key={v.void_id} onClick={() => design(v.void_id)}
              className={`w-full rounded-lg border p-3 text-left transition-all ${selected === v.void_id ? "border-nova-500/60 bg-nova-500/10 shadow-glow" : "border-line bg-void-900/60 hover:border-line-bright"}`}>
              <div className="flex items-center gap-2">
                <Lightbulb className={`h-4 w-4 ${selected === v.void_id ? "text-nova-400" : "text-mist-500"}`} />
                <span className="metric-num text-xs font-bold text-mist-100">{v.void_id}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Badge color="#22d3ee">{v.o2_pct_target}% O₂</Badge>
                <Badge color="#60a5fa">{v.pressure_psi_target} psi</Badge>
                <Badge color="#4ade80">{v.flow_cms_target} cm/s</Badge>
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-mist-500">{v.reason}</p>
            </button>
          ))}
        </div>
      </Panel>

      <div className="space-y-4">
        {loading ? <Loading label="Designing virtual experiment" /> : protocol && (
          <>
            <Panel title={protocol.title} icon={<FlaskConical className="h-4 w-4" />} right={<Badge color="#e879f9">{protocol.hypothesis_id}</Badge>}>
              <div className="rounded-lg border border-nova-500/30 bg-nova-500/5 p-4">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-nova-400">Formal Scientific Hypothesis</div>
                <p className="text-sm leading-relaxed text-mist-200">{protocol.formal_scientific_hypothesis}</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-void-900/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-mist-500">Target Atmosphere</div>
                  <div className="mt-1 text-sm font-semibold text-ion-300">{protocol.target_atmosphere}</div>
                </div>
                <div className="rounded-lg border border-line bg-void-900/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-mist-500">Digital Twin Prediction</div>
                  <div className="mt-1 text-sm font-bold" style={{ color: REGIME_COLORS[pred?.predicted_regime] }}>{pred?.predicted_regime}</div>
                  <div className="metric-num mt-0.5 text-[11px] text-mist-500">T_flame {pred?.estimated_flame_temperature_K} K · Da {pred?.damkohler_proxy}</div>
                </div>
              </div>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Recommended Flight Configuration" icon={<Satellite className="h-4 w-4" />}>
                <div className="space-y-2">
                  {cfg && Object.entries(cfg).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5 border-b border-line/50 pb-2 last:border-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-ember-400">{k.replace(/_/g, " ")}</span>
                      <span className="text-xs text-mist-300">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Validation Success Criteria" icon={<CheckCircle2 className="h-4 w-4" />}>
                <div className="space-y-2.5">
                  {protocol.validation_success_criteria?.map((c: string, i: number) => (
                    <div key={i} className="flex gap-2.5 rounded-lg border border-line bg-void-900/60 px-3 py-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pulse-400" />
                      <span className="text-xs leading-relaxed text-mist-300">{c}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-line bg-void-900/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-mist-500">Parameter Void Addressed</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-mist-400">{protocol.parameter_void_addressed}</p>
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}