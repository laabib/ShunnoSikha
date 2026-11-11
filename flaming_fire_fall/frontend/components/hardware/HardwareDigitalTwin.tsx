"use client";

import React, { useEffect, useState } from "react";
import {
  Cpu, Radio, Sliders, Flame, Play, Pause, Square, RotateCcw,
  AlertTriangle, Terminal, CheckCircle2, Cable, Activity, Sparkles,
} from "lucide-react";
import { useSensors } from "@/lib/sensors";
import { fireApi, CREW_COLORS, SEVERITY_COLORS } from "@/lib/fire";
import { Panel, Badge } from "../ui";
import ArduinoScene from "./ArduinoScene";

const SLIDER_SPECS = [
  { key: "o2_pct", label: "Oxygen (O₂)", pin: "A0", unit: "%", min: 10, max: 40, step: 0.1, color: "#22d3ee" },
  { key: "co_ppm", label: "Carbon Monoxide (CO)", pin: "A1", unit: "ppm", min: 0, max: 300, step: 0.5, color: "#f97316" },
  { key: "co2_ppm", label: "Carbon Dioxide (CO₂)", pin: "A4/A5 I2C", unit: "ppm", min: 300, max: 25000, step: 50, color: "#e879f9" },
  { key: "temp_C", label: "Temperature", pin: "D2", unit: "°C", min: 0, max: 120, step: 0.5, color: "#fbbf24" },
  { key: "humidity_pct", label: "Humidity", pin: "D2", unit: "%", min: 5, max: 95, step: 1, color: "#60a5fa" },
  { key: "smoke_mgm3", label: "Smoke / Particulate", pin: "A2", unit: "mg/m³", min: 0, max: 10, step: 0.05, color: "#94a3b8" },
  { key: "pressure_kpa", label: "Cabin Pressure", pin: "A4/A5 I2C", unit: "kPa", min: 40, max: 120, step: 0.2, color: "#4ade80" },
  { key: "airflow_cms", label: "Ventilation Airflow", pin: "A3", unit: "cm/s", min: 0, max: 30, step: 0.25, color: "#38bdf8" },
];

const STATUS_COLORS: Record<string, string> = {
  normal: "#22d3ee",
  warning: "#fbbf24",
  critical: "#ef4444",
  missing: "#64748b",
  stale: "#a78bfa",
  disconnected: "#475569",
  uncalibrated: "#fb923c",
};

const SENSOR_ROLES: Record<string, string> = {
  o2_pct: "Monitors oxygen enrichment or depletion; elevated O2 widens material flammability.",
  co_ppm: "Primary early toxic-gas indicator for hidden wire smolder and incomplete combustion.",
  co2_ppm: "Tracks metabolic accumulation and combustion product build-up in closed cabins.",
  temp_C: "Measures cabin ambient thermal rise from exothermic reactions or avionics overheating.",
  humidity_pct: "Tracks cabin moisture balance and thermal-comfort / condensation boundary.",
  smoke_mgm3: "Optical / particulate smoke density channel for early microgravity aerosol detection.",
  pressure_kpa: "Spacecraft hull pressure integrity and exploration atmosphere baseline (101.3 kPa ISS).",
  airflow_cms: "HVAC duct flow rate; drives the microgravity U-shaped radiative extinction / blowoff boundary.",
};

export default function HardwareDigitalTwin({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { snapshot, connected, error, command, setMode, patchSensors } = useSensors();
  const [selected, setSelected] = useState("o2_pct");
  const [layout, setLayout] = useState<any>(null);
  const [scenarios, setScenarios] = useState<any>(null);
  const [busyMode, setBusyMode] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [draftValues, setDraftValues] = useState<Record<string, number>>({});

  useEffect(() => {
    fireApi.layout().then(setLayout).catch(() => {});
    fireApi.scenarios().then(setScenarios).catch(() => {});
  }, []);

  const mode: "simulation" | "live" = snapshot?.mode === "live" ? "live" : "simulation";
  const isSim = mode === "simulation";
  const hw = snapshot?.hardware || {};
  const sensors = snapshot?.sensors || {};
  const fireState = snapshot?.fire_state || {};
  const cfg = fireState?.config || {};
  const crew = snapshot?.crew || {};
  const activeSensor = sensors[selected];
  const commErrors: any[] = Array.isArray(hw.communication_errors) ? hw.communication_errors : [];

  const switchMode = async (next: "simulation" | "live") => {
    setBusyMode(true);
    setActionErr("");
    try {
      await setMode(next);
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusyMode(false);
    }
  };

  const applyEnv = async (key: string, val: number) => {
    if (!Number.isFinite(val)) return;
    setDraftValues((d) => ({ ...d, [key]: val }));
    setActionErr("");
    try {
      await patchSensors({ [key]: val });
    } catch (e: any) {
      setActionErr(e.message);
    }
  };

  const runFire = async (path: string, body?: unknown) => {
    setActionErr("");
    try {
      await command(path, body);
    } catch (e: any) {
      setActionErr(e.message);
    }
  };

  const selectPreset = async (preset: string) => {
    setActionErr("");
    try {
      await command("/api/presentation/select", { scenario: preset, confirmed: preset === "suppression" });
    } catch (e: any) {
      setActionErr(e.message);
    }
  };

  const formatReading = (v: any, key: string) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return "—";
    if (key === "co2_ppm") return v.toFixed(0);
    if (key === "smoke_mgm3") return v.toFixed(2);
    return v.toFixed(1);
  };

  return (
    <div className="space-y-4">
      {/* Operating Mode & Provenance Header */}
      <div className="panel border-2 p-4" style={{ borderColor: isSim ? "#f59e0b55" : hw.connected ? "#22d3ee55" : "#ef444455" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-void-900">
              <Cpu className={`h-6 w-6 ${isSim ? "text-amber-400" : hw.connected ? "text-cyan-400" : "text-rose-400"}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold tracking-wide text-mist-100">
                  3D ARDUINO UNO DIGITAL TWIN
                </h2>
                <Badge color={isSim ? "#fbbf24" : hw.connected ? "#22d3ee" : "#ef4444"} pulse={!isSim && !!hw.connected}>
                  {isSim ? "SYNTHETIC / SIMULATED" : hw.connected ? "LIVE HARDWARE DATA" : "LIVE HARDWARE · OFFLINE"}
                </Badge>
                <Badge color={connected ? "#4ade80" : "#ef4444"}>
                  {connected ? "WS STREAM SYNCED" : "POLLING"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-mist-400">
                {isSim
                  ? "Mode B (Interactive Simulation): sliders, fire engine, and presets drive one centralized state across 3D Arduino, monitoring, survival, and AI."
                  : "Mode A (Live Hardware): USB serial readings only. Missing, stale, or uncalibrated hardware channels are withheld — never fabricated."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-void-950 p-1">
            <button
              type="button"
              disabled={busyMode}
              onClick={() => switchMode("simulation")}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                isSim
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-glow"
                  : "text-mist-400 hover:text-mist-200"
              }`}
            >
              Mode B · Simulation
            </button>
            <button
              type="button"
              disabled={busyMode}
              onClick={() => switchMode("live")}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                !isSim
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-ion"
                  : "text-mist-400 hover:text-mist-200"
              }`}
            >
              Mode A · Live Hardware
            </button>
          </div>
        </div>
        {(actionErr || error) && (
          <div className="mt-3 rounded-lg border border-flame-500/50 bg-flame-500/10 px-3 py-2 text-xs text-flame-400">
            {actionErr || error}
          </div>
        )}
      </div>

      {/* Main 3D Scene + Inspector & Live Channel List */}
      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <ArduinoScene snapshot={snapshot} selected={selected} onSelect={setSelected} />

        <div className="space-y-4">
          {/* Selected Sensor / Pin Inspector */}
          <Panel
            title="Component & Pin Inspector"
            icon={<Cable className="h-4 w-4" />}
            right={
              activeSensor && (
                <Badge color={STATUS_COLORS[activeSensor.status] || "#64748b"}>
                  {String(activeSensor.status || "missing").toUpperCase()}
                </Badge>
              )
            }
          >
            {activeSensor ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-mist-100">{activeSensor.label}</div>
                    <div className="font-mono text-[11px] text-ion-400">Arduino Pin: {activeSensor.pin}</div>
                  </div>
                  <div className="text-right">
                    <div className="metric-num text-2xl font-bold" style={{ color: STATUS_COLORS[activeSensor.status] || "#e2e8f0" }}>
                      {formatReading(activeSensor.value, selected)}{" "}
                      <span className="text-xs font-normal text-mist-400">{activeSensor.unit}</span>
                    </div>
                    <div className="metric-num text-[10px] text-mist-500">
                      prev: {formatReading(activeSensor.previous_value, selected)} {activeSensor.unit}
                    </div>
                  </div>
                </div>
                <p className="rounded-lg border border-line bg-void-900/70 px-3 py-2 text-xs leading-relaxed text-mist-300">
                  {SENSOR_ROLES[selected]}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md border border-line bg-void-900 px-2.5 py-1.5">
                    <span className="text-mist-500">Source: </span>
                    <span className="font-mono text-mist-200">{isSim ? "SIMULATED" : "USB SERIAL"}</span>
                  </div>
                  <div className="rounded-md border border-line bg-void-900 px-2.5 py-1.5">
                    <span className="text-mist-500">Updated: </span>
                    <span className="font-mono text-mist-200">
                      {activeSensor.timestamp ? String(activeSensor.timestamp).split("T")[1]?.slice(0, 8) + "Z" : "never"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-xs text-mist-500">Click any sensor module or label on the 3D Arduino board to inspect it.</div>
            )}

            {/* Quick Channel Grid */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {SLIDER_SPECS.map((sp) => {
                const r = sensors[sp.key];
                const st = r?.status || "missing";
                const c = STATUS_COLORS[st] || "#64748b";
                const isSel = selected === sp.key;
                return (
                  <button
                    key={sp.key}
                    type="button"
                    onClick={() => setSelected(sp.key)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                      isSel ? "border-amber-400/70 bg-amber-500/10" : "border-line bg-void-900/70 hover:border-line-bright"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="truncate font-semibold text-mist-300">{sp.label.split(" ")[0]}</span>
                      <span className="font-mono text-[9px] text-mist-500">{sp.pin.split(" ")[0]}</span>
                    </div>
                    <div className="metric-num mt-0.5 text-sm font-bold text-mist-100">
                      {formatReading(r?.value, sp.key)} <span className="text-[10px] font-normal text-mist-500">{sp.unit}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[9px] uppercase" style={{ color: c }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                      {st}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Unified Fire & Crew Status Card */}
          <Panel
            title="Synchronized Emergency State"
            icon={<Activity className="h-4 w-4" />}
            right={
              onNavigate && (
                <button type="button" onClick={() => onNavigate("fire")} className="btn btn-ion !px-2.5 !py-1 text-[11px]">
                  Open Fire Console
                </button>
              )
            }
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-line bg-void-900/70 p-2.5">
                <div className="text-[9px] uppercase text-mist-500">Fire Detection</div>
                <div className="mt-0.5 font-display text-xs font-bold" style={{ color: fireState.detected || fireState.possible_fire ? "#ef4444" : "#22c55e" }}>
                  {isSim ? (fireState.detected ? "DETECTED" : "NONE") : fireState.possible_fire ? "POSSIBLE" : "NO SIGNATURE"}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-void-900/70 p-2.5">
                <div className="text-[9px] uppercase text-mist-500">Severity</div>
                <div className="mt-0.5 font-display text-xs font-bold" style={{ color: SEVERITY_COLORS[fireState.severity] || "#8b99b5" }}>
                  {fireState.severity || "Unknown"}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-void-900/70 p-2.5">
                <div className="text-[9px] uppercase text-mist-500">Crew Risk</div>
                <div className="mt-0.5 font-display text-xs font-bold" style={{ color: CREW_COLORS[crew.status] || "#8b99b5" }}>
                  {crew.status || "UNKNOWN"}
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-mist-400">{crew.explanation}</p>
          </Panel>
        </div>
      </div>

      {/* Mode-Specific Control Workbench */}
      {isSim ? (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Panel
            title="Interactive Simulation Mode · Manipulate All Sensors"
            icon={<Sliders className="h-4 w-4" />}
            right={<Badge color="#fbbf24">SYNTHETIC / SIMULATED</Badge>}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {SLIDER_SPECS.map((sp) => {
                const liveVal = sensors[sp.key]?.value;
                const val = typeof liveVal === "number" ? liveVal : draftValues[sp.key] ?? sp.min;
                return (
                  <div key={sp.key} className="rounded-lg border border-line bg-void-900/60 p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-mist-200">
                        {sp.label} <span className="font-mono text-[10px] text-mist-500">({sp.pin})</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={sp.min}
                          max={sp.max}
                          step={sp.step}
                          value={Number(val.toFixed(sp.step < 1 ? 2 : 0))}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value);
                            if (Number.isFinite(n)) void applyEnv(sp.key, Math.min(sp.max, Math.max(sp.min, n)));
                          }}
                          className="input !w-20 !py-1 !px-2 text-right font-mono text-xs"
                        />
                        <span className="w-10 font-mono text-[10px] text-mist-500">{sp.unit}</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={sp.min}
                      max={sp.max}
                      step={sp.step}
                      value={Math.min(sp.max, Math.max(sp.min, val))}
                      onChange={(e) => void applyEnv(sp.key, parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-500">Quick Presets:</span>
              {[
                { id: "normal", label: "Normal Spacecraft" },
                { id: "electrical", label: "Electrical Fire" },
                { id: "battery", label: "Battery Event" },
                { id: "critical", label: "Critical Cabin" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void selectPreset(p.id)}
                  className={`chip hover:border-amber-400/60 hover:text-amber-200 ${
                    snapshot?.presentation?.scenario === p.id ? "!border-amber-400/70 !bg-amber-500/15 !text-amber-300" : ""
                  }`}
                >
                  <Sparkles className="h-3 w-3" /> {p.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Integrated Fire Trigger & Propagation"
            icon={<Flame className="h-4 w-4" />}
            right={<Badge color={SEVERITY_COLORS[fireState.severity] || "#22c55e"}>{String(fireState.status || "idle").toUpperCase()}</Badge>}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="label">Fire Type</span>
                  <select
                    value={cfg.fire_type || "electrical"}
                    disabled={fireState.status === "running"}
                    onChange={(e) => void runFire("/api/fire/config", { fire_type: e.target.value })}
                    className="input !py-1.5 text-xs disabled:opacity-50"
                  >
                    {Object.entries(scenarios?.fire_types || {}).map(([k, v]: [string, any]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">Fire Location</span>
                  <select
                    value={cfg.ignition || "USLAB"}
                    disabled={fireState.status === "running"}
                    onChange={(e) => void runFire("/api/fire/config", { ignition: e.target.value })}
                    className="input !py-1.5 text-xs disabled:opacity-50"
                  >
                    {(layout?.compartments || []).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-mist-400">Fire Intensity</span>
                    <span className="font-mono text-ember-400">{(cfg.initial_intensity ?? 0.35).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={cfg.initial_intensity ?? 0.35}
                    onChange={(e) => void runFire("/api/fire/config", { initial_intensity: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-mist-400">Spread Speed</span>
                    <span className="font-mono text-ion-400">{(cfg.spread_multiplier ?? 1).toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={cfg.spread_multiplier ?? 1}
                    onChange={(e) => void runFire("/api/fire/config", { spread_multiplier: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {fireState.status !== "running" ? (
                  <button type="button" onClick={() => void runFire("/api/fire/start")} className="btn btn-primary flex-1 !py-2 text-xs">
                    <Play className="h-3.5 w-3.5" /> {fireState.status === "paused" ? "Resume Fire" : "Start Fire"}
                  </button>
                ) : (
                  <button type="button" onClick={() => void runFire("/api/fire/pause")} className="btn flex-1 !border-amber-500/60 !text-amber-300 !py-2 text-xs">
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                )}
                <button type="button" onClick={() => void runFire("/api/fire/stop")} className="btn !py-2 text-xs" title="Stop combustion">
                  <Square className="h-3.5 w-3.5" /> Stop
                </button>
                <button type="button" onClick={() => void runFire("/api/fire/reset")} className="btn !py-2 text-xs" title="Reset scenario">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-mist-500">
                Starting a fire drives temperature, smoke, CO, CO₂, O₂, 3D Arduino pin states, fire map spread, crew risk, and AI assessment from one simulation engine.
              </p>
            </div>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Live Hardware Connection & Gateway Status"
            icon={<Radio className="h-4 w-4" />}
            right={
              <Badge color={hw.connected ? "#22d3ee" : "#ef4444"} pulse={!!hw.connected}>
                {String(hw.status || "disconnected").toUpperCase()}
              </Badge>
            }
          >
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-void-900/70 p-2.5">
                <div className="text-[10px] text-mist-500">Board / Device</div>
                <div className="mt-0.5 font-mono font-semibold text-mist-100">
                  {hw.board || "Arduino Uno"} · {hw.device_id || "NO DEVICE"}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-void-900/70 p-2.5">
                <div className="text-[10px] text-mist-500">Packet Frequency</div>
                <div className="mt-0.5 font-mono font-semibold text-cyan-300">{hw.frequency_hz ?? 0} Hz</div>
              </div>
              <div className="rounded-lg border border-line bg-void-900/70 p-2.5">
                <div className="text-[10px] text-mist-500">Last Received Timestamp</div>
                <div className="mt-0.5 font-mono text-[11px] text-mist-200">{hw.last_received_at || "No packet received"}</div>
              </div>
              <div className="rounded-lg border border-line bg-void-900/70 p-2.5">
                <div className="text-[10px] text-mist-500">Actuation Interlock</div>
                <div className="mt-0.5 font-mono text-[11px] text-amber-300">LOCKED (Read-Only Serial)</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-mist-400">
                Communication Errors ({commErrors.length})
              </div>
              {commErrors.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-void-900/60 px-3 py-2 text-xs text-mist-400">
                  <CheckCircle2 className="h-4 w-4 text-pulse-400" /> No gateway communication errors reported.
                </div>
              ) : (
                <div className="max-h-36 space-y-1.5 overflow-auto">
                  {commErrors.slice().reverse().map((errItem, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg border border-flame-500/40 bg-flame-500/10 px-2.5 py-1.5 text-[11px] text-flame-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        <div className="font-mono text-[9px] text-mist-400">{errItem.timestamp}</div>
                        <div>{errItem.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel title="USB Serial Hardware Gateway Setup" icon={<Terminal className="h-4 w-4" />}>
            <p className="text-xs leading-relaxed text-mist-300">
              Arduino Uno connects via USB serial through the read-only local serial gateway. No simulated values are substituted when hardware is disconnected or uncalibrated.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-void-950 p-3 font-mono text-[11px] leading-relaxed text-cyan-200">{`# 1. Enumerate attached Arduino USB serial ports
python3 -m shunnoshikha.serial_gateway --list

# 2. Stream Arduino Uno serial JSON to the local backend
python3 -m shunnoshikha.serial_gateway \\
  --port /dev/cu.usbmodem1101 \\
  --board "Arduino Uno" \\
  --device-id uno-cabin-01`}</pre>
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
              Pin reference: O₂ → A0 · CO → A1 · Smoke → A2 · Airflow → A3 · Temp/Humidity → D2 · CO₂ & Pressure → A4 (SDA) / A5 (SCL).
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
