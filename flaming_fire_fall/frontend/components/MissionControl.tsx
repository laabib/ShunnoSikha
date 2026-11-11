"use client";

import React, { useEffect, useState } from "react";
import {
  Activity, Flame, Wind, Gauge as GaugeIcon, Thermometer, AlertTriangle,
  Fan, ShieldAlert, Waves, Cpu, MonitorPlay, Siren, Sliders,
} from "lucide-react";
import { api, TIER_COLORS, REGIME_COLORS } from "@/lib/api";
import { TelemetryFrame } from "@/lib/useTelemetry";
import { useSensors } from "@/lib/sensors";
import { CREW_COLORS, SEVERITY_COLORS } from "@/lib/fire";
import { Panel, Gauge, Sparkline, Badge, Stat } from "./ui";
import ArduinoScene from "./hardware/ArduinoScene";

export default function MissionControl({
  frame,
  history,
  connected,
  series,
  onNavigate,
}: {
  frame: TelemetryFrame | null;
  history: TelemetryFrame[];
  connected: boolean;
  series: (k: keyof TelemetryFrame["telemetry"]) => number[];
  onNavigate?: (view: string) => void;
}) {
  const { snapshot, setMode, command } = useSensors();
  const [scenarios, setScenarios] = useState<any>({});
  const [active, setActive] = useState("NOMINAL_ISS");
  const [selectedSensor, setSelectedSensor] = useState("o2_pct");
  const [scenarioErr, setScenarioErr] = useState("");

  useEffect(() => {
    api
      .scenarios()
      .then((d) => {
        setScenarios(d.scenarios);
        setActive(d.active);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (frame) setActive(frame.scenario);
  }, [frame?.scenario]);

  const switchScenario = async (key: string) => {
    setScenarioErr("");
    setActive(key);
    try {
      await command("/api/telemetry/set-scenario", { scenario_key: key });
    } catch (e: any) {
      setScenarioErr(e.message);
    }
  };

  const isSim = snapshot?.mode !== "live";
  const hw = snapshot?.hardware || {};
  const fireState = snapshot?.fire_state || {};
  const crew = snapshot?.crew || {};
  const t = frame?.telemetry;
  const safety = frame?.safety;
  const twin = frame?.digital_twin;
  const tier = safety?.safety_tier || (isSim ? "NORMAL" : "UNKNOWN");
  const tierColor = TIER_COLORS[tier] || "#8b99b5";

  const sensors = snapshot?.sensors || {};
  const events: any[] = (fireState?.events || []).slice(-8).reverse();

  return (
    <div className="stagger space-y-4">
      {/* Safety & Provenance Banner */}
      <div
        className="panel relative overflow-hidden !border-2 p-5"
        style={{ borderColor: `${tierColor}66`, boxShadow: `0 0 40px -14px ${tierColor}66` }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ background: `radial-gradient(600px 200px at 20% 0%, ${tierColor}, transparent)` }}
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ background: `${tierColor}22`, border: `1px solid ${tierColor}66` }}
          >
            <ShieldAlert className="h-7 w-7" style={{ color: tierColor }} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-2xl font-extrabold tracking-wide" style={{ color: tierColor }}>
                {tier}
              </span>
              <Badge color={isSim ? "#fbbf24" : hw.connected ? "#22d3ee" : "#ef4444"}>
                {isSim ? "SYNTHETIC / SIMULATED" : hw.connected ? "LIVE HARDWARE" : "LIVE · DISCONNECTED"}
              </Badge>
              <Badge color={connected ? "#4ade80" : "#ef4444"} pulse>
                {connected ? "WS STREAM LIVE" : "RECONNECTING"}
              </Badge>
              <span className="text-xs text-mist-500">{frame?.scenario_name || (isSim ? "Simulation" : "Live serial")}</span>
            </div>
            <div className="mt-1 text-sm text-mist-300">
              {safety?.rule_violations?.length
                ? safety.rule_violations[0]
                : crew.explanation || "All cabin environmental parameters within configured nominal envelope."}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <>
                <button type="button" onClick={() => onNavigate("arduino")} className="btn btn-ion !py-1.5 text-xs">
                  <Sliders className="h-3.5 w-3.5" /> Twin & Sim Controls
                </button>
                <button type="button" onClick={() => onNavigate("presentation")} className="btn btn-primary !py-1.5 text-xs">
                  <MonitorPlay className="h-3.5 w-3.5" /> Presentation Mode
                </button>
              </>
            )}
            <div className="text-right pl-2">
              <div className="text-[10px] uppercase tracking-wider text-mist-500">Severity Index</div>
              <div className="metric-num text-3xl font-bold" style={{ color: tierColor }}>
                {safety?.severity_score ?? "—"}
                <span className="text-sm text-mist-500">/100</span>
              </div>
            </div>
          </div>
        </div>
        {safety?.hvac_suppression_action && (
          <div className="relative mt-3 rounded-lg border border-line bg-void-900/70 px-3 py-2 text-xs text-mist-300">
            <span className="font-semibold" style={{ color: tierColor }}>
              SAFETY PROTOCOL ·{" "}
            </span>
            {safety.hvac_suppression_action}
          </div>
        )}
      </div>

      {/* MAIN: Interactive 3D Arduino Uno Digital Twin + Fire Detection & Live Channels */}
      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <ArduinoScene
          snapshot={snapshot}
          selected={selectedSensor}
          onSelect={setSelectedSensor}
          heightClass="h-[440px] min-h-[380px] sm:h-[480px]"
        />

        <div className="space-y-4">
          <Panel
            title="Operating Mode & Fire Detection"
            icon={<Siren className="h-4 w-4" />}
            right={
              onNavigate && (
                <button type="button" onClick={() => onNavigate("fire")} className="btn !px-2.5 !py-1 text-[11px]">
                  Fire Console →
                </button>
              )
            }
          >
            <div className="mb-3 flex gap-1.5 rounded-lg border border-line bg-void-950 p-1">
              <button
                type="button"
                onClick={() => void setMode("simulation")}
                className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                  isSim ? "bg-amber-500/20 text-amber-300 border border-amber-500/50" : "text-mist-400 hover:text-mist-200"
                }`}
              >
                Simulation Mode
              </button>
              <button
                type="button"
                onClick={() => void setMode("live")}
                className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                  !isSim ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50" : "text-mist-400 hover:text-mist-200"
                }`}
              >
                Live Hardware Mode
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Fire Status"
                value={
                  isSim
                    ? fireState.detected
                      ? "FIRE DETECTED"
                      : "NO FIRE"
                    : fireState.possible_fire
                    ? "ANOMALY"
                    : "UNVERIFIED"
                }
                accent={fireState.detected || fireState.possible_fire ? "#ef4444" : "#22c55e"}
                sub={isSim ? fireState.fire_type?.name : "Live sensors cannot classify fire"}
              />
              <Stat
                label="Crew Risk"
                value={crew.status || "UNKNOWN"}
                accent={CREW_COLORS[crew.status] || "#8b99b5"}
                sub={`Habitability: ${crew.habitability || "UNKNOWN"}`}
              />
              <Stat
                label="Arduino Link"
                value={isSim ? "VIRTUAL" : String(hw.status || "disconnected").toUpperCase()}
                accent={isSim ? "#fbbf24" : hw.connected ? "#22d3ee" : "#ef4444"}
                sub={isSim ? "SIM-UNO-01" : `${hw.frequency_hz ?? 0} Hz · ${hw.device_id || "no device"}`}
              />
              <Stat
                label="CO₂ / Humidity"
                value={
                  typeof sensors.co2_ppm?.value === "number"
                    ? `${sensors.co2_ppm.value.toFixed(0)} ppm`
                    : "—"
                }
                accent="#e879f9"
                sub={`RH: ${typeof sensors.humidity_pct?.value === "number" ? `${sensors.humidity_pct.value.toFixed(1)}%` : "—"}`}
              />
            </div>
          </Panel>

          <Panel
            title="Live Arduino Sensor Channels"
            icon={<Cpu className="h-4 w-4" />}
            right={
              onNavigate && (
                <button type="button" onClick={() => onNavigate("arduino")} className="text-[11px] font-semibold text-ion-400 hover:text-ion-300">
                  Manipulate Sensors →
                </button>
              )
            }
          >
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(sensors).map(([k, r]: [string, any]) => {
                const v = typeof r?.value === "number" ? r.value : null;
                const st = r?.status || "missing";
                const col =
                  st === "critical"
                    ? "#ef4444"
                    : st === "warning"
                    ? "#fbbf24"
                    : st === "normal"
                    ? "#22d3ee"
                    : "#64748b";
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedSensor(k)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                      selectedSensor === k
                        ? "border-amber-400/70 bg-amber-500/10"
                        : "border-line bg-void-900/70 hover:border-line-bright"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-mist-400">
                      <span className="truncate">{r.label}</span>
                      <span className="font-mono text-[9px] text-mist-500">{r.pin?.split(" ")[0]}</span>
                    </div>
                    <div className="metric-num mt-0.5 text-sm font-bold text-mist-100">
                      {v === null ? "—" : k === "co2_ppm" ? v.toFixed(0) : v.toFixed(2)}{" "}
                      <span className="text-[10px] font-normal text-mist-500">{r.unit}</span>
                    </div>
                    <div className="text-[9px] uppercase" style={{ color: col }}>
                      {st}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Oxygen", unit: "% O₂", v: t?.o2_concentration_pct, min: 15, max: 35, color: "#22d3ee", icon: <Waves className="h-4 w-4" />, danger: (t?.o2_concentration_pct ?? 21) > 28 },
          { label: "Airflow", unit: "cm/s", v: t?.airflow_velocity_cms, min: 0, max: 25, color: "#4ade80", icon: <Wind className="h-4 w-4" />, danger: t?.airflow_velocity_cms != null && t.airflow_velocity_cms < 1.5 },
          { label: "Pressure", unit: "psi", v: t?.cabin_pressure_psi, min: 7, max: 16, color: "#60a5fa", icon: <GaugeIcon className="h-4 w-4" /> },
          { label: "Cabin Temp", unit: "°C", v: t?.cabin_temp_C, min: 15, max: 60, color: "#fbbf24", icon: <Thermometer className="h-4 w-4" />, danger: (t?.cabin_temp_C ?? 22) > 45 },
          { label: "Carbon Monoxide", unit: "ppm CO", v: t?.co_ppm, min: 0, max: 120, color: "#f97316", icon: <Flame className="h-4 w-4" />, danger: (t?.co_ppm ?? 0) > 25 },
          { label: "Smoke / Mass", unit: "mg/m³", v: t?.smoke_mgm3, min: 0, max: 5, color: "#e879f9", icon: <Activity className="h-4 w-4" />, danger: (t?.smoke_mgm3 ?? 0) > 0.5 },
        ].map((g) => (
          <div key={g.label} className="panel flex flex-col items-center py-3">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-mist-500">
              <span style={{ color: g.color }}>{g.icon}</span>
              {g.label}
            </div>
            <Gauge value={g.v} min={g.min} max={g.max} label="" unit={g.unit} color={g.color} size={116} danger={g.danger} />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Digital twin state */}
        <Panel title="Combustion Digital Twin · Live Regime" icon={<Flame className="h-4 w-4" />}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl"
              style={{
                background: `${REGIME_COLORS[twin?.regime || ""] || "#64748b"}18`,
                border: `1px solid ${REGIME_COLORS[twin?.regime || ""] || "#64748b"}55`,
              }}
            >
              <Flame className="h-8 w-8" style={{ color: REGIME_COLORS[twin?.regime || ""] || "#64748b" }} />
            </div>
            <div>
              <div className="font-display text-lg font-bold" style={{ color: REGIME_COLORS[twin?.regime || ""] || "#94a3b8" }}>
                {twin?.regime || "Unavailable"}
              </div>
              <div className="text-xs text-mist-500">
                Flame temp ≈ {twin?.flame_temp_C?.toFixed(0) ?? "—"} °C · Da {twin?.damkohler_proxy?.toFixed(2) ?? "—"}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {Object.entries(twin?.probabilities || {}).map(([k, v]) => (
              <div key={k}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span className="text-mist-400">{k}</span>
                  <span className="metric-num" style={{ color: REGIME_COLORS[k] }}>
                    {((v as number) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-void-900">
                  <div className="h-full rounded transition-all duration-700" style={{ width: `${(v as number) * 100}%`, background: REGIME_COLORS[k] }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Trends */}
        <Panel title="Unified Telemetry Trends" icon={<Activity className="h-4 w-4" />} className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { k: "o2_concentration_pct" as const, label: "Oxygen %", color: "#22d3ee" },
              { k: "co_ppm" as const, label: "CO ppm", color: "#f97316" },
              { k: "cabin_temp_C" as const, label: "Temp °C", color: "#fbbf24" },
            ].map((s) => (
              <div key={s.k}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-mist-500">{s.label}</span>
                  <span className="metric-num text-sm font-semibold" style={{ color: s.color }}>
                    {t?.[s.k] != null ? t[s.k]!.toFixed(2) : "—"}
                  </span>
                </div>
                <Sparkline data={series(s.k)} color={s.color} height={56} />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Device" value={<span className="text-xs">{frame?.device_id || "—"}</span>} />
            <Stat label="History Samples" value={history.length} accent="#22d3ee" />
            <Stat label="Timestamp" value={<span className="text-xs">{frame?.timestamp?.split("T")[1]?.slice(0, 10) || "—"}</span>} />
            <Stat label="Fire Severity" value={<span className="text-xs">{fireState?.severity || "Normal"}</span>} accent={SEVERITY_COLORS[fireState?.severity] || "#22c55e"} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scenario control */}
        <Panel
          title="HIL Scenario Injection"
          icon={<Fan className="h-4 w-4" />}
          right={<Badge color={isSim ? "#fbbf24" : "#64748b"}>{isSim ? "SIMULATION ONLY" : "LOCKED IN LIVE MODE"}</Badge>}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(scenarios).map(([key, s]: [string, any]) => (
              <button
                key={key}
                type="button"
                disabled={!isSim}
                onClick={() => void switchScenario(key)}
                className={`rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                  active === key && isSim
                    ? "border-ember-500/60 bg-ember-500/10 shadow-glow"
                    : "border-line bg-void-900/60 hover:border-line-bright"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${active === key && isSim ? "bg-ember-400 animate-pulse-dot" : "bg-mist-600"}`} />
                  <span className="text-xs font-semibold text-mist-100">{s.name}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-mist-500">{s.description}</p>
              </button>
            ))}
          </div>
          {scenarioErr && <div className="mt-2 text-xs text-flame-400">{scenarioErr}</div>}
        </Panel>

        {/* Event feed */}
        <Panel title="Centralized Emergency & Telemetry Event Log" icon={<AlertTriangle className="h-4 w-4" />}>
          {events.length === 0 ? (
            <div className="py-6 text-center text-sm text-mist-500">
              No emergency events logged yet. Adjust sensors, inject a scenario, or start a fire simulation.
            </div>
          ) : (
            <div className="max-h-[260px] space-y-2 overflow-auto">
              {events.map((a, i) => {
                const c = a.severity === "critical" ? "#ef4444" : a.severity === "warning" ? "#fbbf24" : "#22d3ee";
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-void-900/60 px-3 py-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                    <span className="metric-num shrink-0 text-[11px] text-mist-500">t={a.t}s</span>
                    <span className="shrink-0 font-mono text-[10px] font-semibold" style={{ color: c }}>
                      {a.type}
                    </span>
                    <span className="flex-1 truncate text-[11px] text-mist-300" title={a.message}>
                      {a.message}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
