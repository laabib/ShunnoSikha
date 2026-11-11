"use client";

import React from "react";
import { HeartPulse, Wind, Skull, Thermometer, CloudFog, Siren, Timer } from "lucide-react";
import { Panel, Badge, Bar, Stat } from "../ui";
import { CREW_COLORS } from "@/lib/fire";

export default function CrewSurvival({ state }: { state: any }) {
  const c = state?.crew || {};
  const isLive = state?.data_source === "LIVE_HARDWARE";
  const status = c.status || (isLive ? "UNKNOWN" : "SAFE");
  const color = CREW_COLORS[status] || "#8b99b5";
  const risks = c.risks || {};
  const atm = state?.atmosphere || {};
  const assumptions: string[] = c.time_to_critical_assumptions || [];
  const fmt = (v: any, digits = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—");

  return (
    <div className="space-y-4">
      <div
        className="panel relative overflow-hidden p-5"
        style={{ borderColor: `${color}66`, boxShadow: `0 0 40px -14px ${color}66` }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ background: `radial-gradient(600px 200px at 20% 0%, ${color}, transparent)` }}
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-xl"
            style={{ background: `${color}22`, border: `1px solid ${color}66` }}
          >
            <HeartPulse className="h-8 w-8" style={{ color }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-mist-500">Astronaut Survival / Environmental Risk Status</span>
              <Badge color={isLive ? "#22d3ee" : "#fbbf24"}>{isLive ? "LIVE HARDWARE" : "SIMULATION"}</Badge>
            </div>
            <div className="font-display text-3xl font-extrabold" style={{ color }}>
              {status}
            </div>
            <div className="mt-1 text-xs text-mist-400">
              Habitability: <span className="font-semibold" style={{ color }}>{c.habitability || "UNKNOWN"}</span> · Action:{" "}
              <span className="font-semibold text-mist-200">{c.evacuation_urgency || "VERIFY SENSOR COVERAGE"}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-mist-500">Env. Time → Critical</div>
            <div className="metric-num text-3xl font-bold" style={{ color }}>
              {c.time_to_critical_s != null ? `${c.time_to_critical_s}s` : "—"}
            </div>
          </div>
        </div>
        <p className="relative mt-3 rounded-lg border border-line bg-void-900/70 px-3 py-2 text-sm text-mist-300">
          {c.explanation}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Multi-Parameter Environmental Risk Factors" icon={<Siren className="h-4 w-4" />}>
          <div className="space-y-3">
            <Bar label="Oxygen availability" value={risks.oxygen ?? 0} max={1} color="#22d3ee" />
            <Bar label="CO toxic gas" value={risks.toxic_gas ?? 0} max={1} color="#f97316" />
            <Bar label="CO₂ exposure" value={risks.co2 ?? 0} max={1} color="#e879f9" />
            <Bar label="Heat / thermal" value={risks.heat ?? 0} max={1} color="#fbbf24" />
            <Bar label="Smoke / aerosol" value={risks.smoke ?? 0} max={1} color="#8b99b5" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="O₂ now" value={fmt(atm.o2_pct, 1)} unit="%" accent="#22d3ee" />
            <Stat label="CO now" value={fmt(atm.co_ppm, 1)} unit="ppm" accent="#f97316" />
            <Stat label="CO₂ now" value={fmt(atm.co2_ppm, 0)} unit="ppm" accent="#e879f9" />
            <Stat label="Temp now" value={fmt(atm.temp_C, 1)} unit="°C" accent="#fbbf24" />
            <Stat label="Smoke now" value={fmt(atm.smoke_mgm3, 2)} unit="mg/m³" accent="#8b99b5" />
            <Stat label="Pressure" value={fmt(atm.pressure_kpa, 1)} unit="kPa" accent="#4ade80" />
          </div>
        </Panel>

        <Panel title="Environmental Time-to-Threshold · Modeled Estimate" icon={<Timer className="h-4 w-4" />}>
          <div className="rounded-lg border border-ember-500/40 bg-ember-500/10 p-4 text-center">
            <div className="text-[10px] uppercase tracking-wider text-ember-400">
              {c.time_to_critical_label || "Environmental time to critical threshold (not human survival)"}
            </div>
            <div className="metric-num mt-1 text-3xl font-bold text-ember-300">
              {c.time_to_critical_s != null ? `${c.time_to_critical_s} s` : "Unavailable"}
            </div>
            <div className="mt-1 text-[10px] text-mist-400">
              {c.time_to_critical_s != null
                ? "Extrapolated from active environmental rate-of-change against configured critical thresholds."
                : "Requires advancing simulation trends across at least two history samples (or unblocked live calibrated trends)."}
            </div>
          </div>

          {assumptions.length > 0 && (
            <div className="mt-3 rounded-lg border border-line bg-void-900/70 p-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-mist-400">Model Basis & Assumptions</div>
              <ul className="space-y-1 text-[11px] text-mist-400">
                {assumptions.map((a, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-ember-400">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 rounded-lg border border-flame-500/40 bg-flame-500/5 p-3 text-[11px] leading-relaxed text-flame-400">
            <strong>Important:</strong> Environmental time-to-threshold is NOT an exact human survival prediction. Real astronaut survival depends on combined gas toxicity, exposure duration, cabin pressure, protective equipment (PBA), and individual physiology — never on sensor values alone.
          </div>

          <div className="mt-3 space-y-1.5 text-[11px] text-mist-400">
            <div className="flex gap-2">
              <Wind className="h-3.5 w-3.5 text-ion-400" /> Don PBA before O₂ drops or CO/CO₂ rise.
            </div>
            <div className="flex gap-2">
              <Skull className="h-3.5 w-3.5 text-flame-400" /> CO and HF/CO₂ off-gassing are acute hazards; monitor continuously.
            </div>
            <div className="flex gap-2">
              <Thermometer className="h-3.5 w-3.5 text-ember-400" /> Heat stress and humidity extremes compound smoke inhalation risk.
            </div>
            <div className="flex gap-2">
              <CloudFog className="h-3.5 w-3.5 text-mist-400" /> Smoke obscuration impedes egress; follow marked escape routes.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
