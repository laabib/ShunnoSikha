"use client";

import React, { useEffect, useRef, useState } from "react";
import { Brain, TrendingUp, AlertCircle, Timer, Wind, Skull } from "lucide-react";
import { api, REGIME_COLORS } from "@/lib/api";
import { Panel, Slider, Stat, Bar, Badge, Loading } from "./ui";

const MATERIALS = ["PMMA", "Nomex", "Cotton-Fiber Blend"];

export default function MLExplain() {
  const [material, setMaterial] = useState("PMMA");
  const [o2, setO2] = useState(21);
  const [flow, setFlow] = useState(7.5);
  const [pressure, setPressure] = useState(14.7);
  const [thickness, setThickness] = useState(2.5);
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      setLoading(true);
      api.predictShap({ material, o2_pct: o2, flow_cms: flow, pressure_psi: pressure, thickness_mm: thickness })
        .then(setRes).catch(() => {}).finally(() => setLoading(false));
    }, 180);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [material, o2, flow, pressure, thickness]);

  const drivers = res?.shap_attribution?.top_drivers || [];
  const maxImpact = Math.max(0.001, ...drivers.map((d: any) => Math.abs(d.impact)));
  const unc = res?.uncertainty;
  const uncColor = unc?.uncertainty_tier?.startsWith("LOW") ? "#4ade80" : unc?.uncertainty_tier?.startsWith("MODERATE") ? "#fbbf24" : "#ef4444";
  const metrics = res?.predicted_metrics;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Panel title="Prediction Inputs" icon={<Brain className="h-4 w-4" />} className="h-fit">
        <div className="space-y-4">
          <div>
            <span className="label">Material</span>
            <select value={material} onChange={(e) => setMaterial(e.target.value)} className="input">
              {MATERIALS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <Slider label="Oxygen" value={o2} min={13} max={35} step={0.1} unit="%" onChange={setO2} color="#22d3ee" />
          <Slider label="Airflow" value={flow} min={0.5} max={24} step={0.1} unit="cm/s" onChange={setFlow} color="#4ade80" />
          <Slider label="Pressure" value={pressure} min={8} max={14.7} step={0.1} unit="psi" onChange={setPressure} color="#60a5fa" />
          <Slider label="Thickness" value={thickness} min={0.1} max={6} step={0.1} unit="mm" onChange={setThickness} color="#e879f9" />
          <div className="rounded-lg border border-line bg-void-900/60 p-3 text-[11px] leading-relaxed text-mist-500">
            XGBoost regime classifier trained on the compiled NASA flight matrix. TreeSHAP attributes each prediction;
            Mahalanobis distance flags out-of-distribution exploration atmospheres.
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        {loading && !res ? <Loading label="Running inference + SHAP" /> : res && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="panel flex flex-col justify-center p-4" style={{ borderColor: `${REGIME_COLORS[res.predicted_regime]}55` }}>
                <div className="text-[10px] uppercase tracking-wider text-mist-500">Predicted Regime</div>
                <div className="font-display mt-1 text-lg font-bold leading-tight" style={{ color: REGIME_COLORS[res.predicted_regime] }}>{res.predicted_regime}</div>
                <div className="metric-num mt-1 text-xs text-mist-400">{(res.probabilities[res.predicted_regime] * 100).toFixed(1)}% confidence</div>
              </div>
              <Stat label="Burn Duration" value={metrics?.total_burn_duration_frames ?? "—"} unit="frames" accent="#fbbf24" sub={`${metrics?.burn_duration_seconds ?? "—"} seconds @30fps`} />
              <Stat label="O₂ Depletion" value={metrics?.oxygen_depletion_delta_pct ?? "—"} unit="Δ%" accent="#22d3ee" />
              <Stat label="Toxic CO Yield" value={metrics?.toxic_co_generation_ppm ?? "—"} unit="ppm" accent="#f97316" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="SHAP Feature Attribution" icon={<TrendingUp className="h-4 w-4" />}
                right={<Badge color="#e879f9">TreeSHAP</Badge>}>
                <div className="space-y-2.5">
                  {drivers.map((d: any) => (
                    <Bar key={d.feature} label={d.feature} value={d.impact} max={maxImpact}
                      color={d.impact > 0 ? "#f59e0b" : "#22d3ee"} />
                  ))}
                </div>
                <div className="mt-3 flex gap-4 text-[10px] text-mist-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-ember-500" /> Promotes regime</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-ion-400" /> Inhibits regime</span>
                </div>
              </Panel>

              <Panel title="OOD Uncertainty Quantification" icon={<AlertCircle className="h-4 w-4" />}>
                <div className="flex items-center gap-4">
                  <div className="relative flex h-28 w-28 items-center justify-center">
                    <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#1b2742" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={uncColor} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(unc?.confidence_pct ?? 0) * 2.64} 264`} style={{ filter: `drop-shadow(0 0 5px ${uncColor}88)`, transition: "all 0.6s" }} />
                    </svg>
                    <div className="text-center">
                      <div className="metric-num text-2xl font-bold" style={{ color: uncColor }}>{unc?.confidence_pct ?? "—"}%</div>
                      <div className="text-[9px] uppercase text-mist-500">confidence</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <Badge color={uncColor}>{unc?.uncertainty_tier}</Badge>
                    <p className="mt-2 text-xs leading-relaxed text-mist-400">{unc?.description}</p>
                    <div className="metric-num mt-2 text-[11px] text-mist-500">Mahalanobis D<sub>M</sub> = {unc?.mahalanobis_distance}</div>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}