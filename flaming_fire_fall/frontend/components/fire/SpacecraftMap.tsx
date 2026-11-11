"use client";

import React from "react";
import { intensityColor } from "@/lib/fire";

export default function SpacecraftMap({
  layout,
  state,
  pickMode = false,
  onPick,
}: {
  layout: any;
  state: any;
  pickMode?: boolean;
  onPick?: (id: string) => void;
}) {
  const comps: any[] = layout?.compartments || [];
  const adj: Record<string, string[]> = layout?.adjacency || {};
  const cs = state?.compartments || {};
  const center = (c: any) => [c.x + c.w / 2, c.y + c.h / 2];
  const byId = Object.fromEntries(comps.map((c) => [c.id, c]));
  const burning: string[] = state?.fire?.burning || [];
  const spreadTo = state?.fire?.spread_direction;
  const isLive = state?.data_source === "LIVE_HARDWARE";

  return (
    <div>
      <svg viewBox="0 0 100 62" className="w-full select-none" style={{ minHeight: 220 }}>
        <defs>
          <filter id="fire-glow">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="smoke-grad">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
          </radialGradient>
          <marker id="arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#ef4444" />
          </marker>
        </defs>
        {/* hull outline */}
        <rect x="11" y="5" width="70" height="52" rx="6" fill="#0a0f1e" stroke="#1e2a47" strokeWidth="0.6" />
        {/* corridors */}
        {comps.map((c) =>
          (adj[c.id] || []).map((n) => {
            const o = byId[n];
            if (!o || n < c.id) return null;
            const [x1, y1] = center(c);
            const [x2, y2] = center(o);
            return (
              <line
                key={`${c.id}-${n}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={state?.suppression?.isolated ? "#fbbf24" : "#2c3d63"}
                strokeWidth="1.4"
                strokeDasharray={state?.suppression?.isolated ? "0.7 1.2" : "1.5 1"}
              />
            );
          })
        )}
        {/* spread arrow */}
        {burning[0] &&
          spreadTo &&
          byId[burning[0]] &&
          byId[spreadTo] &&
          (() => {
            const [x1, y1] = center(byId[burning[0]]);
            const [x2, y2] = center(byId[spreadTo]);
            return (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#ef4444"
                strokeWidth="0.8"
                strokeDasharray="2 1"
                className="animate-pulse-dot"
                markerEnd="url(#arrow)"
              />
            );
          })()}
        {/* compartments */}
        {comps.map((c) => {
          const st = cs[c.id] || {};
          const inten = st.intensity || 0;
          const onFire = !!st.on_fire;
          const affected = !!st.affected;
          const fill = onFire ? intensityColor(inten) : affected ? "#3b3325" : "#131c33";
          const isIgn = !isLive && state?.config?.ignition === c.id;
          const tempLabel = typeof st.temp_C === "number" ? `${st.temp_C.toFixed(0)}°` : "";
          return (
            <g key={c.id} onClick={() => pickMode && onPick?.(c.id)} style={{ cursor: pickMode ? "pointer" : "default" }}>
              <rect
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx="2"
                fill={fill}
                fillOpacity={onFire ? 0.85 : affected ? 0.6 : 0.9}
                stroke={isIgn ? "#fcd34d" : onFire ? intensityColor(inten) : "#2c3d63"}
                strokeWidth={isIgn ? 0.9 : 0.5}
                style={{ transition: "fill 0.6s, stroke 0.6s", filter: onFire ? "url(#fire-glow)" : undefined }}
              />
              {(st.smoke || 0) > 0.05 && !onFire && (
                <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="2" fill="url(#smoke-grad)" opacity={Math.min(0.8, st.smoke)} />
              )}
              {onFire && (
                <g className="animate-pulse-dot" filter="url(#fire-glow)">
                  <path
                    d={`M${c.x + c.w / 2},${c.y + 2.5} c1.6,2 2.6,3 2.6,4.6 a2.6,2.6 0 0,1 -5.2,0 c0,-1.6 1,-2.6 2.6,-4.6 Z`}
                    fill="#fff7ed"
                    opacity="0.95"
                  />
                  <path
                    d={`M${c.x + c.w / 2},${c.y + 4} c0.9,1.2 1.5,1.9 1.5,2.9 a1.5,1.5 0 0,1 -3,0 c0,-1 0.6,-1.7 1.5,-2.9 Z`}
                    fill="#fbbf24"
                  />
                </g>
              )}
              <text
                x={c.x + c.w / 2}
                y={c.y + c.h - 2}
                textAnchor="middle"
                fontSize="2.5"
                fill={onFire ? "#0a0f1e" : "#8b99b5"}
                fontWeight="700"
                className="metric-num"
              >
                {c.id}
              </text>
              {tempLabel && (
                <text
                  x={c.x + c.w - 1.2}
                  y={c.y + 3.2}
                  textAnchor="end"
                  fontSize="2.1"
                  fill={onFire ? "#0a0f1e" : "#64748b"}
                  className="metric-num"
                >
                  {tempLabel}
                </text>
              )}
              {isIgn && <circle cx={c.x + 2} cy={c.y + 2} r="1" fill="#fcd34d" />}
            </g>
          );
        })}
      </svg>
      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-mist-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#131c33", border: "1px solid #2c3d63" }} /> Nominal
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#3b3325" }} /> Affected / smoke
        </span>
        {[0.15, 0.4, 0.6, 0.9].map((i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: intensityColor(i) }} />{" "}
            {i < 0.25 ? "Low" : i < 0.5 ? "Med" : i < 0.75 ? "High" : "Extreme"}
          </span>
        ))}
        {pickMode && <span className="ml-auto text-ember-400">Click a compartment to set ignition point</span>}
      </div>

      {/* Per-compartment readout grid */}
      {!isLive && comps.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {comps.map((c) => {
            const st = cs[c.id] || {};
            return (
              <div
                key={c.id}
                className={`rounded-md border px-2 py-1 text-[10px] ${
                  st.on_fire
                    ? "border-flame-500/60 bg-flame-500/10"
                    : st.affected
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-line bg-void-900/60"
                }`}
              >
                <div className="flex items-center justify-between font-mono font-semibold text-mist-200">
                  <span>{c.id}</span>
                  <span style={{ color: st.on_fire ? "#ef4444" : st.affected ? "#fbbf24" : "#64748b" }}>
                    {st.on_fire ? `🔥 ${(st.intensity * 100).toFixed(0)}%` : st.affected ? "SMOKE" : "OK"}
                  </span>
                </div>
                <div className="metric-num flex justify-between text-[9px] text-mist-500">
                  <span>{typeof st.temp_C === "number" ? `${st.temp_C.toFixed(1)}°C` : "—"}</span>
                  <span>smoke {typeof st.smoke === "number" ? `${(st.smoke * 100).toFixed(0)}%` : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
