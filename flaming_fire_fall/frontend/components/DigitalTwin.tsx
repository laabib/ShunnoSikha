"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Flame, RefreshCw, Shuffle, Crosshair, Layers } from "lucide-react";
import { api, REGIME_COLORS } from "@/lib/api";
import { Panel, Slider, Badge, Stat, Loading } from "./ui";

const MATERIALS = ["PMMA", "Nomex", "Cotton-Fiber Blend"];
const REGIME_IDX: Record<string, number> = { "Radiative Extinction": 0, "Sustained Burn": 1, Blowoff: 2 };
const GRID_COLORS = ["#0e7490", "#f59e0b", "#c026d3"];

export default function DigitalTwin() {
  const [material, setMaterial] = useState("PMMA");
  const [o2, setO2] = useState(21);
  const [flow, setFlow] = useState(7.5);
  const [pressure, setPressure] = useState(14.7);
  const [thickness, setThickness] = useState(2.5);
  const [evalRes, setEvalRes] = useState<any>(null);
  const [surface, setSurface] = useState<any>(null);
  const [atmos, setAtmos] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { api.atmospheres().then(setAtmos).catch(() => {}); }, []);

  useEffect(() => {
    api.boundarySurface(material, pressure, 30).then(setSurface).catch(() => {});
  }, [material, pressure]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.twinEvaluate({ material, o2_pct: o2, flow_cms: flow, pressure_psi: pressure, thickness_mm: thickness })
        .then(setEvalRes).catch(() => {}).finally(() => setLoading(false));
    }, 120);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [material, o2, flow, pressure, thickness]);

  const applyAtmos = (key: string) => {
    const a = atmos[key];
    if (!a) return;
    setO2(a.o2_pct); setPressure(a.pressure_psi);
  };
  const reset = () => { setMaterial("PMMA"); setO2(21); setFlow(7.5); setPressure(14.7); setThickness(2.5); };
  const randomize = () => {
    setMaterial(MATERIALS[Math.floor(Math.random() * 3)]);
    setO2(+(14 + Math.random() * 21).toFixed(1));
    setFlow(+(0.5 + Math.random() * 23).toFixed(1));
    setPressure(+(8 + Math.random() * 6.7).toFixed(1));
  };

  const pm = evalRes?.physics_metrics;
  const regime = evalRes?.regime;

  // heatmap geometry
  const W = 560, H = 380, padL = 46, padB = 34, padT = 12, padR = 12;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const flows: number[] = surface?.flow_values || [];
  const o2s: number[] = surface?.o2_values || [];
  const grid: number[][] = surface?.boundary_grid || [];
  const xOf = (u: number) => padL + ((u - flows[0]) / (flows[flows.length - 1] - flows[0] || 1)) * plotW;
  const yOf = (o: number) => padT + plotH - ((o - o2s[0]) / (o2s[o2s.length - 1] - o2s[0] || 1)) * plotH;

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      {/* Permanent control deck */}
      <div className="space-y-4">
        <Panel title="Atmosphere Control Deck" icon={<Crosshair className="h-4 w-4" />}>
          <div className="space-y-4">
            <div>
              <span className="label">Fuel Material</span>
              <div className="grid grid-cols-3 gap-1.5">
                {MATERIALS.map((m) => (
                  <button key={m} onClick={() => setMaterial(m)}
                    className={`rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-all ${material === m ? "border-ember-500/60 bg-ember-500/15 text-ember-300" : "border-line bg-void-900 text-mist-400 hover:border-line-bright"}`}>
                    {m === "Cotton-Fiber Blend" ? "Cotton" : m}
                  </button>
                ))}
              </div>
            </div>
            <Slider label="Oxygen Concentration" value={o2} min={13} max={35} step={0.1} unit="%" onChange={setO2} color="#22d3ee" />
            <Slider label="Forced Airflow" value={flow} min={0.5} max={24} step={0.1} unit="cm/s" onChange={setFlow} color="#4ade80" />
            <Slider label="Cabin Pressure" value={pressure} min={8} max={14.7} step={0.1} unit="psi" onChange={setPressure} color="#60a5fa" />
            <Slider label="Sample Thickness" value={thickness} min={0.1} max={6} step={0.1} unit="mm" onChange={setThickness} color="#e879f9" />
            <div className="flex gap-2">
              <button onClick={reset} className="btn flex-1 !py-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Reset</button>
              <button onClick={randomize} className="btn flex-1 !py-1.5 text-xs"><Shuffle className="h-3.5 w-3.5" /> Randomize</button>
            </div>
          </div>
        </Panel>

        <Panel title="Exploration Atmospheres" icon={<Layers className="h-4 w-4" />}>
          <div className="space-y-1.5">
            {Object.entries(atmos).map(([key, a]: [string, any]) => (
              <button key={key} onClick={() => applyAtmos(key)}
                className="w-full rounded-lg border border-line bg-void-900/60 px-3 py-2 text-left transition-all hover:border-ion-500/50 hover:bg-ion-500/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-mist-200">{a.name}</span>
                  <span className="metric-num text-[11px] text-ion-400">{a.o2_pct}% · {a.pressure_psi}psi</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-mist-500">{a.description}</p>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* Visualization + results */}
      <div className="space-y-4">
        <Panel title="U-Shaped Flammability Boundary Manifold" icon={<Flame className="h-4 w-4" />}
          right={<div className="flex gap-3 text-[10px]">{Object.entries(REGIME_COLORS).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{k}</span>)}</div>}>
          {!surface ? <Loading label="Computing boundary surface" /> : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              <defs>
                <filter id="pt-glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {/* grid cells */}
              {grid.map((row, i) => row.map((cell, j) => {
                const x = padL + (j / row.length) * plotW;
                const y = padT + ((grid.length - 1 - i) / grid.length) * plotH;
                return <rect key={`${i}-${j}`} x={x} y={y} width={plotW / row.length + 0.5} height={plotH / grid.length + 0.5} fill={GRID_COLORS[cell]} opacity={0.55} />;
              }))}
              {/* axes */}
              <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#2c3d63" />
              <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#2c3d63" />
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const u = flows[0] + f * (flows[flows.length - 1] - flows[0]);
                const o = o2s[0] + f * (o2s[o2s.length - 1] - o2s[0]);
                return <g key={f}>
                  <text x={xOf(u)} y={H - 12} textAnchor="middle" fill="#64748b" fontSize="10" className="metric-num">{u.toFixed(0)}</text>
                  <text x={padL - 8} y={yOf(o) + 3} textAnchor="end" fill="#64748b" fontSize="10" className="metric-num">{o.toFixed(0)}</text>
                </g>;
              })}
              <text x={padL + plotW / 2} y={H - 1} textAnchor="middle" fill="#8b99b5" fontSize="10">Airflow velocity (cm/s)</text>
              <text x={12} y={padT + plotH / 2} textAnchor="middle" fill="#8b99b5" fontSize="10" transform={`rotate(-90 12 ${padT + plotH / 2})`}>Oxygen (%)</text>
              {/* operating point */}
              {flows.length > 0 && (
                <g filter="url(#pt-glow)">
                  <line x1={xOf(flow)} y1={padT} x2={xOf(flow)} y2={padT + plotH} stroke="#eef2f9" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
                  <line x1={padL} y1={yOf(o2)} x2={padL + plotW} y2={yOf(o2)} stroke="#eef2f9" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
                  <circle cx={xOf(flow)} cy={yOf(o2)} r="7" fill={REGIME_COLORS[regime] || "#fff"} stroke="#05070f" strokeWidth="2" />
                  <circle cx={xOf(flow)} cy={yOf(o2)} r="12" fill="none" stroke={REGIME_COLORS[regime] || "#fff"} strokeWidth="1" opacity="0.5" className="animate-pulse-dot" />
                </g>
              )}
            </svg>
          )}
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel title="Regime Evaluation" icon={<Flame className="h-4 w-4" />}>
            {loading && !evalRes ? <Loading /> : evalRes && (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl font-bold" style={{ color: REGIME_COLORS[regime] }}>{regime}</span>
                  {loading && <span className="text-[10px] text-mist-500">updating…</span>}
                </div>
                <div className="mt-3 space-y-2">
                  {Object.entries(evalRes.probabilities).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-[11px]"><span className="text-mist-400">{k}</span><span className="metric-num" style={{ color: REGIME_COLORS[k] }}>{((v as number) * 100).toFixed(1)}%</span></div>
                      <div className="h-1.5 overflow-hidden rounded bg-void-900"><div className="h-full rounded transition-all duration-500" style={{ width: `${(v as number) * 100}%`, background: REGIME_COLORS[k] }} /></div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>
          <Panel title="Physics Metrics" icon={<Layers className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Limiting O₂ Index" value={pm?.limiting_oxygen_index ?? "—"} unit="%" accent="#22d3ee" />
              <Stat label="O₂ Margin" value={pm?.o2_margin ?? "—"} unit="%" accent={pm?.o2_margin < 0 ? "#ef4444" : "#4ade80"} />
              <Stat label="Damköhler Proxy" value={pm?.damkohler_proxy ?? "—"} accent="#e879f9" />
              <Stat label="Radiative Loss Idx" value={pm?.radiative_loss_index ?? "—"} accent="#f97316" />
              <Stat label="Flame Temp" value={pm?.estimated_flame_temp_C ?? "—"} unit="°C" accent="#fbbf24" />
              <Stat label="Flame Temp" value={pm?.estimated_flame_temp_K ?? "—"} unit="K" accent="#fbbf24" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}