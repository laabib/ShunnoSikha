"use client";

import React, { useState } from "react";
import { Play, Pause, Square, RotateCcw, Gauge as GaugeIcon, Flame, FastForward, Sliders } from "lucide-react";
import { Panel, Slider, Badge, Sparkline, Stat } from "../ui";
import SpacecraftMap from "./SpacecraftMap";
import { fireApi, SEVERITY_COLORS } from "@/lib/fire";
import { useSensors } from "@/lib/sensors";

const SPEEDS = [1, 2, 5, 10];

export default function FireSimulation({
  state,
  layout,
  scenarios,
  refresh,
}: {
  state: any;
  layout: any;
  scenarios: any;
  refresh: () => void;
}) {
  const { snapshot, setMode, patchSensors } = useSensors();
  const [pickMode, setPickMode] = useState(false);
  const [err, setErr] = useState("");
  const isSim = snapshot?.mode !== "live";
  const cfg = state?.config || {};
  const atm = state?.atmosphere || {};
  const running = state?.status === "running";
  const paused = state?.status === "paused";
  const editable = isSim && !running;
  const hist = state?.history || [];
  const series = (k: string) => hist.map((h: any) => h[k]).filter((v: any) => typeof v === "number");

  const setCfg = (patch: any) => {
    setErr("");
    fireApi
      .config(patch)
      .then(refresh)
      .catch((e) => setErr(e.message));
  };
  const act = (fn: Promise<any>) => {
    setErr("");
    fn.then(refresh).catch((e) => setErr(e.message));
  };
  const patchEnv = (key: string, val: number) => {
    setErr("");
    void patchSensors({ [key]: val }).catch((e) => setErr(e.message));
  };

  return (
    <div className="space-y-4">
      {!isSim && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-xs text-amber-200">
            <strong>Live Hardware Mode active:</strong> Fire simulation controls are disabled while streaming physical hardware telemetry.
          </div>
          <button type="button" onClick={() => void setMode("simulation")} className="btn btn-primary !py-1.5 text-xs">
            Switch to Simulation Mode
          </button>
        </div>
      )}

      {err && <div className="rounded-lg border border-flame-500/50 bg-flame-500/10 px-3 py-2 text-xs text-flame-400">{err}</div>}

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        {/* Permanent control deck */}
        <div className="space-y-4">
          <Panel title="Simulation Control Deck" icon={<GaugeIcon className="h-4 w-4" />}>
            <div className="mb-3 flex gap-1.5">
              {!running ? (
                <button
                  type="button"
                  disabled={!isSim}
                  onClick={() => act(fireApi.start())}
                  className="btn btn-primary flex-1 !py-2 text-xs"
                >
                  <Play className="h-4 w-4" /> {paused ? "Resume" : "Start Fire"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isSim}
                  onClick={() => act(fireApi.pause())}
                  className="btn flex-1 !border-ember-500/60 !text-ember-300 !py-2 text-xs"
                >
                  <Pause className="h-4 w-4" /> Pause
                </button>
              )}
              <button
                type="button"
                disabled={!isSim}
                onClick={() => act(fireApi.stop())}
                className="btn !px-3 !py-2 text-xs"
                title="Stop Fire"
              >
                <Square className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!isSim}
                onClick={() => act(fireApi.reset())}
                className="btn !px-3 !py-2 text-xs"
                title="Reset Scenario"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3">
              <span className="label">Simulation Speed</span>
              <div className="grid grid-cols-4 gap-1.5">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!isSim}
                    onClick={() => act(fireApi.speed(s))}
                    className={`rounded-md border py-1.5 text-xs font-bold transition-all disabled:opacity-40 ${
                      cfg.speed === s
                        ? "border-ion-500/60 bg-ion-500/15 text-ion-300"
                        : "border-line bg-void-900 text-mist-400 hover:border-line-bright"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="label">Fire Type / Scenario</span>
                <select
                  value={cfg.fire_type}
                  disabled={!editable}
                  onChange={(e) => setCfg({ fire_type: e.target.value })}
                  className="input disabled:opacity-50"
                >
                  {Object.entries(scenarios?.fire_types || {}).map(([k, v]: [string, any]) => (
                    <option key={k} value={k}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Ignition Compartment</span>
                <div className="flex gap-1.5">
                  <select
                    value={cfg.ignition}
                    disabled={!editable}
                    onChange={(e) => setCfg({ ignition: e.target.value })}
                    className="input flex-1 disabled:opacity-50"
                  >
                    {(layout?.compartments || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPickMode((p) => !p)}
                    disabled={!editable}
                    className={`btn !px-2.5 ${pickMode ? "!border-ember-500/60 !text-ember-300" : ""}`}
                    title="Pick on map"
                  >
                    <Flame className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Slider
                label="Fire Intensity"
                value={cfg.initial_intensity ?? 0.35}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(v) => isSim && setCfg({ initial_intensity: v })}
                color="#f97316"
              />
              <Slider
                label="Fire Spread Speed"
                value={cfg.spread_multiplier ?? 1.0}
                min={0}
                max={3}
                step={0.1}
                unit="x"
                onChange={(v) => isSim && setCfg({ spread_multiplier: v })}
                color="#e879f9"
              />
              <Slider
                label="Oxygen Concentration"
                value={atm.o2_pct ?? cfg.o2_pct ?? 21}
                min={12}
                max={40}
                step={0.5}
                unit="%"
                onChange={(v) => isSim && patchEnv("o2_pct", v)}
                color="#22d3ee"
              />
              <Slider
                label="Ventilation Airflow"
                value={cfg.ventilation_cms ?? 7.5}
                min={0}
                max={30}
                step={0.5}
                unit="cm/s"
                onChange={(v) => isSim && patchEnv("airflow_cms", v)}
                color="#4ade80"
              />
            </div>
            {!editable && isSim && (
              <p className="mt-3 text-[10px] text-mist-500">Pause or reset to change ignition compartment or fire type.</p>
            )}
          </Panel>

          <Panel title="Synthetic Sensor Overrides" icon={<Sliders className="h-4 w-4" />}>
            <div className="space-y-3">
              <Slider label="Carbon Monoxide" value={atm.co_ppm ?? 0.5} min={0} max={300} step={1} unit="ppm" onChange={(v) => isSim && patchEnv("co_ppm", v)} color="#f97316" />
              <Slider label="Carbon Dioxide" value={atm.co2_ppm ?? 3000} min={400} max={25000} step={100} unit="ppm" onChange={(v) => isSim && patchEnv("co2_ppm", v)} color="#e879f9" />
              <Slider label="Temperature" value={atm.temp_C ?? 22} min={10} max={90} step={0.5} unit="°C" onChange={(v) => isSim && patchEnv("temp_C", v)} color="#fbbf24" />
              <Slider label="Humidity" value={atm.humidity_pct ?? 45} min={10} max={95} step={1} unit="%" onChange={(v) => isSim && patchEnv("humidity_pct", v)} color="#60a5fa" />
              <Slider label="Smoke Density" value={atm.smoke_mgm3 ?? 0.02} min={0} max={10} step={0.05} unit="mg/m³" onChange={(v) => isSim && patchEnv("smoke_mgm3", v)} color="#94a3b8" />
              <Slider label="Cabin Pressure" value={atm.pressure_kpa ?? 101.3} min={50} max={115} step={0.2} unit="kPa" onChange={(v) => isSim && patchEnv("pressure_kpa", v)} color="#4ade80" />
            </div>
          </Panel>
        </div>

        {/* Live visualization */}
        <div className="space-y-4">
          <Panel
            title="Animated Compartment Fire Spread"
            icon={<Flame className="h-4 w-4" />}
            right={<Badge color={SEVERITY_COLORS[state?.severity] || "#22c55e"} pulse>{state?.status?.toUpperCase()}</Badge>}
          >
            <SpacecraftMap
              layout={layout}
              state={state}
              pickMode={pickMode && editable}
              onPick={(id) => {
                setCfg({ ignition: id });
                setPickMode(false);
              }}
            />
          </Panel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Sim Time" value={state?.sim_time ?? "—"} unit="s" accent="#22d3ee" />
            <Stat label="Burning Comps" value={(state?.fire?.burning || []).length} accent="#ef4444" />
            <Stat label="Time→Critical" value={state?.time_to_critical_s ?? "—"} unit="s" accent="#fbbf24" />
            <Stat
              label="Crew Status"
              value={
                <span
                  style={{
                    color:
                      SEVERITY_COLORS[
                        state?.crew?.status === "SAFE"
                          ? "Normal"
                          : state?.crew?.status === "CAUTION"
                          ? "Warning"
                          : state?.crew?.status === "DANGER"
                          ? "Critical"
                          : "Extreme"
                      ] || "#8b99b5",
                  }}
                >
                  {state?.crew?.status}
                </span>
              }
            />
          </div>
          <Panel title="Fire Growth & Environmental Trends" icon={<FastForward className="h-4 w-4" />}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { k: "intensity", label: "Total Fire Intensity", color: "#f97316" },
                { k: "temp_C", label: "Cabin Temp °C", color: "#fbbf24" },
                { k: "o2_pct", label: "Oxygen %", color: "#22d3ee" },
                { k: "co_ppm", label: "CO ppm", color: "#ef4444" },
                { k: "co2_ppm", label: "CO₂ ppm", color: "#e879f9" },
                { k: "smoke_mgm3", label: "Smoke mg/m³", color: "#8b99b5" },
              ].map((s) => (
                <div key={s.k}>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-mist-500">{s.label}</span>
                    <span className="metric-num" style={{ color: s.color }}>
                      {hist.length && typeof hist[hist.length - 1][s.k] === "number" ? hist[hist.length - 1][s.k] : "—"}
                    </span>
                  </div>
                  <Sparkline data={series(s.k)} color={s.color} height={48} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
