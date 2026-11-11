"use client";

import React, { useEffect, useState } from "react";
import {
  Radar, Play, ShieldAlert, Waves, HeartPulse, BrainCircuit, ScrollText, Siren, MonitorPlay,
} from "lucide-react";
import { useFireSim, fireApi, SEVERITY_COLORS, CREW_COLORS } from "@/lib/fire";
import { Badge } from "../ui";
import FireMonitoring from "./FireMonitoring";
import FireSimulation from "./FireSimulation";
import SuppressionControl from "./SuppressionControl";
import AtmosphereMonitor from "./AtmosphereMonitor";
import CrewSurvival from "./CrewSurvival";
import AIIntelligence from "./AIIntelligence";
import EmergencyHistory from "./EmergencyHistory";
import PresentationMode from "./PresentationMode";

const TABS = [
  { id: "monitoring", label: "Fire Monitoring", icon: Radar },
  { id: "simulation", label: "Fire Simulation", icon: Play },
  { id: "suppression", label: "Suppression Control", icon: ShieldAlert },
  { id: "atmosphere", label: "Atmospheric Monitoring", icon: Waves },
  { id: "crew", label: "Astronaut Survival", icon: HeartPulse },
  { id: "ai", label: "AI Emergency Intelligence", icon: BrainCircuit },
  { id: "history", label: "History & Reports", icon: ScrollText },
  { id: "presentation", label: "Presentation Mode", icon: MonitorPlay },
];

export default function FireConsole({ initialTab = "monitoring" }: { initialTab?: string }) {
  const { state, snapshot, connected, refresh } = useFireSim();
  const [tab, setTab] = useState(initialTab);
  const [layout, setLayout] = useState<any>(null);
  const [scenarios, setScenarios] = useState<any>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fireApi.layout().then(setLayout).catch(() => {});
    fireApi.scenarios().then(setScenarios).catch(() => {});
  }, []);

  const isSim = snapshot?.mode !== "live";
  const sev = state?.severity || (isSim ? "Normal" : "Unknown");
  const sc = SEVERITY_COLORS[sev] || "#8b99b5";
  const crew = state?.crew?.status || (isSim ? "SAFE" : "UNKNOWN");
  const cc = CREW_COLORS[crew] || "#8b99b5";
  const atm = state?.atmosphere || {};
  const f = state?.fire || {};
  const active = state?.status === "running" || state?.status === "paused";

  const fmt = (v: any, decimals = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(decimals) : "—");

  return (
    <div className="space-y-4">
      {/* Emergency banner */}
      <div
        className="panel relative overflow-hidden !border-2 p-4"
        style={{ borderColor: `${sc}66`, boxShadow: `0 0 36px -14px ${sc}66` }}
      >
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{ background: `radial-gradient(700px 200px at 15% 0%, ${sc}, transparent)` }}
        />
        <div className="relative flex flex-wrap items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: `${sc}22`, border: `1px solid ${sc}66` }}
          >
            <Siren className="h-6 w-6" style={{ color: sc }} />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl font-extrabold tracking-wide" style={{ color: sc }}>
                {sev.toUpperCase()}
              </span>
              <Badge color={connected ? "#4ade80" : "#fbbf24"} pulse>
                {connected ? "CENTRAL STREAM LIVE" : "POLLING"}
              </Badge>
              <Badge color={isSim ? "#fbbf24" : "#22d3ee"}>
                {isSim ? "SYNTHETIC / SIMULATION" : "LIVE HARDWARE"}
              </Badge>
              {active && (
                <Badge color={sc} pulse>
                  {state?.status?.toUpperCase()} · {state?.sim_time}s · {state?.speed}x
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-mist-400">
              {state?.fire_type?.name} · {f.location} · crew{" "}
              <span style={{ color: cc }} className="font-semibold">
                {crew}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-mist-500">Crew Status</div>
            <div className="font-display text-lg font-bold" style={{ color: cc }}>
              {crew}
            </div>
          </div>
        </div>
      </div>

      {/* Persistent dashboard stats (null-safe; never fabricates readings in live mode) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          {
            label: "Fire Status",
            v: isSim ? (state?.detected ? "DETECTED" : "NONE") : state?.possible_fire ? "POSSIBLE" : "UNKNOWN",
            c: state?.detected || state?.possible_fire ? "#ef4444" : isSim ? "#22c55e" : "#8b99b5",
          },
          { label: "Intensity", v: fmt(f.total_intensity, 2), c: "#f97316" },
          { label: "Spread mm/s", v: fmt(f.propagation_speed_mms, 2), c: "#e879f9" },
          { label: "Temp °C", v: fmt(atm.temp_C, 1), c: "#fbbf24" },
          { label: "O₂ %", v: fmt(atm.o2_pct, 1), c: "#22d3ee" },
          { label: "CO ppm", v: fmt(atm.co_ppm, 1), c: "#ef4444" },
          { label: "Crew", v: crew, c: cc },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-line bg-void-850/80 px-2.5 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-mist-500">{s.label}</div>
            <div className="metric-num mt-0.5 truncate text-base font-bold" style={{ color: s.c }}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                on
                  ? "border-flame-500/60 bg-flame-500/15 text-flame-400 shadow-glow"
                  : "border-line bg-void-850 text-mist-400 hover:border-line-bright hover:text-mist-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Section */}
      {!state ? (
        <div className="panel p-8 text-center text-sm text-mist-500">Connecting to centralized sensor & fire engine…</div>
      ) : (
        <>
          {tab === "monitoring" && <FireMonitoring state={state} layout={layout} />}
          {tab === "simulation" && <FireSimulation state={state} layout={layout} scenarios={scenarios} refresh={refresh} />}
          {tab === "suppression" && <SuppressionControl state={state} refresh={refresh} />}
          {tab === "atmosphere" && <AtmosphereMonitor state={state} refresh={refresh} />}
          {tab === "crew" && <CrewSurvival state={state} />}
          {tab === "ai" && <AIIntelligence state={state} />}
          {tab === "history" && <EmergencyHistory state={state} />}
          {tab === "presentation" && <PresentationMode layout={layout} />}
        </>
      )}
    </div>
  );
}
