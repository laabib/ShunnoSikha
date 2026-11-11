"use client";

import React, { useEffect, useState } from "react";
import {
  MonitorPlay, Play, Pause, RotateCcw, Sparkles, ShieldCheck,
  Flame, Zap, BatteryWarning, AlertOctagon, CheckCircle2,
} from "lucide-react";
import { useSensors } from "@/lib/sensors";
import { fireApi, CREW_COLORS, SEVERITY_COLORS } from "@/lib/fire";
import { Panel, Badge, ConfirmDialog, Stat } from "../ui";
import ArduinoScene from "../hardware/ArduinoScene";
import SpacecraftMap from "./SpacecraftMap";

const SCENARIOS = [
  {
    id: "normal",
    num: "01",
    title: "Normal Spacecraft",
    desc: "All sensors operating nominally, zero combustion, crew SAFE.",
    icon: ShieldCheck,
    color: "#22c55e",
    notes: "Baseline ISS-equivalent atmosphere (21% O₂, 101.3 kPa, 22°C). Demonstrates steady 3D Arduino sensor traffic.",
  },
  {
    id: "electrical",
    num: "02",
    title: "Electrical Fire",
    desc: "Avionics compartment ignition; smoke, CO, and thermal spread visualized.",
    icon: Zap,
    color: "#f97316",
    notes: "Class C energized ignition in US Lab. Demonstrates smoke/CO escalation, compartment propagation, and water-blocking safety interlock.",
  },
  {
    id: "battery",
    num: "03",
    title: "Battery Thermal Event",
    desc: "Lithium-ion thermal runaway with rapid heating and toxic off-gassing.",
    icon: BatteryWarning,
    color: "#ef4444",
    notes: "High heat-release and CO/smoke yield. Recommends dedicated battery containment rather than generic water.",
  },
  {
    id: "critical",
    num: "04",
    title: "Critical Cabin Conditions",
    desc: "Low oxygen (16%) with elevated CO (80 ppm), CO₂, heat (46°C), and smoke.",
    icon: AlertOctagon,
    color: "#e879f9",
    notes: "Simultaneous atmospheric threshold breaches trigger CRITICAL crew alerts and urgent PBA/evacuation guidance.",
  },
  {
    id: "suppression",
    num: "05",
    title: "Successful Fire Suppression",
    desc: "Electrical fire followed by scripted simulated suppression at t=15s and recovery.",
    icon: CheckCircle2,
    color: "#22d3ee",
    notes: "Requires explicit judge confirmation to arm the scripted t=15s suppressant activation. Watch fire decay and atmosphere recover.",
  },
];

const SPEEDS = [1, 2, 5, 10];

export default function PresentationMode({ layout: initialLayout }: { layout?: any }) {
  const { snapshot, command, setMode } = useSensors();
  const [layout, setLayout] = useState<any>(initialLayout || null);
  const [selectedSensor, setSelectedSensor] = useState("co_ppm");
  const [confirmSuppression, setConfirmSuppression] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!layout) {
      fireApi.layout().then(setLayout).catch(() => {});
    }
  }, [layout]);

  const isSim = snapshot?.mode !== "live";
  const pres = snapshot?.presentation || { scenario: "normal", status: "idle" };
  const fireState = snapshot?.fire_state || {};
  const crew = snapshot?.crew || {};
  const sensors = snapshot?.sensors || {};
  const activeScenario = SCENARIOS.find((s) => s.id === pres.scenario) || SCENARIOS[0];

  const ensureSimAndRun = async (fn: () => Promise<any>) => {
    setErr("");
    try {
      if (!isSim) {
        await setMode("simulation");
      }
      await fn();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const chooseScenario = (id: string) => {
    if (id === "suppression") {
      setConfirmSuppression(true);
      return;
    }
    void ensureSimAndRun(() => command("/api/presentation/select", { scenario: id, confirmed: false }));
  };

  const confirmAndSelectSuppression = () => {
    setConfirmSuppression(false);
    void ensureSimAndRun(() => command("/api/presentation/select", { scenario: "suppression", confirmed: true }));
  };

  const runAction = (action: "start" | "pause" | "resume" | "reset") => {
    void ensureSimAndRun(() => command("/api/presentation/action", { action }));
  };

  const setSpeed = (speed: number) => {
    void ensureSimAndRun(() => command("/api/fire/speed", { speed }));
  };

  const isRunning = pres.status === "running" || fireState.status === "running";
  const isPaused = !isRunning && (pres.status === "paused" || fireState.status === "paused");
  const statusLabel = isRunning ? "RUNNING" : isPaused ? "PAUSED" : String(fireState.status || pres.status || "idle").toUpperCase();

  return (
    <div className="space-y-4">
      <Panel
        title="NASA Space Apps Presentation & Judge Demonstration Mode"
        icon={<MonitorPlay className="h-4 w-4" />}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="#fbbf24">SYNTHETIC / NO HARDWARE REQUIRED</Badge>
            <Badge color={isRunning ? "#4ade80" : isPaused ? "#fbbf24" : "#8b99b5"} pulse={isRunning}>
              {statusLabel}
            </Badge>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-mist-100">
              Active Scenario {activeScenario.num}: <span style={{ color: activeScenario.color }}>{activeScenario.title}</span>
            </div>
            <p className="mt-0.5 text-xs text-mist-400">{activeScenario.notes}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isRunning ? (
              <button
                type="button"
                onClick={() => runAction(isPaused ? "resume" : "start")}
                className="btn btn-primary !py-2 text-xs"
              >
                <Play className="h-3.5 w-3.5" /> {isPaused ? "Resume" : "Start Presentation"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runAction("pause")}
                className="btn !border-amber-500/60 !text-amber-300 !py-2 text-xs"
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </button>
            )}
            <button type="button" onClick={() => runAction("reset")} className="btn !py-2 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-void-950 p-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`rounded px-2 py-1 font-mono text-[11px] font-bold transition-all ${
                    fireState?.config?.speed === s
                      ? "bg-ion-500/20 text-ion-300 border border-ion-500/50"
                      : "text-mist-400 hover:text-mist-200"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
        {err && <div className="mt-3 rounded-lg border border-flame-500/50 bg-flame-500/10 px-3 py-2 text-xs text-flame-400">{err}</div>}
      </Panel>

      {/* 5 Predefined Scenarios */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {SCENARIOS.map((sc) => {
          const Icon = sc.icon;
          const active = pres.scenario === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => chooseScenario(sc.id)}
              className={`panel p-3.5 text-left transition-all hover:border-line-bright ${
                active ? "!border-2 shadow-glow" : ""
              }`}
              style={{ borderColor: active ? `${sc.color}88` : undefined, background: active ? `${sc.color}10` : undefined }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-mist-500">SCENARIO {sc.num}</span>
                <Icon className="h-4 w-4" style={{ color: sc.color }} />
              </div>
              <div className="mt-1.5 text-xs font-bold text-mist-100">{sc.title}</div>
              <p className="mt-1 text-[11px] leading-snug text-mist-400">{sc.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Synchronized Twin + Compartment Map + Live KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Sim Time" value={fireState.sim_time ?? 0} unit="s" accent="#22d3ee" />
        <Stat
          label="Fire Severity"
          value={fireState.severity || "Normal"}
          accent={SEVERITY_COLORS[fireState.severity] || "#22c55e"}
        />
        <Stat label="Crew Risk" value={crew.status || "SAFE"} accent={CREW_COLORS[crew.status] || "#22c55e"} />
        <Stat
          label="O₂ / CO"
          value={`${typeof sensors.o2_pct?.value === "number" ? sensors.o2_pct.value.toFixed(1) : "—"}%`}
          sub={`CO ${typeof sensors.co_ppm?.value === "number" ? sensors.co_ppm.value.toFixed(1) : "—"} ppm`}
          accent="#fbbf24"
        />
        <Stat
          label="Suppression"
          value={fireState?.suppression?.active ? "ACTIVE" : "STANDBY"}
          sub={pres.scenario === "suppression" && !fireState?.suppression?.active ? "Scripted trigger at t=15s" : fireState?.suppression?.method || "None"}
          accent={fireState?.suppression?.active ? "#22d3ee" : "#94a3b8"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <ArduinoScene
          snapshot={snapshot}
          selected={selectedSensor}
          onSelect={setSelectedSensor}
          heightClass="h-[420px] min-h-[360px]"
        />
        <Panel
          title="Synchronized Compartment Fire Propagation"
          icon={<Flame className="h-4 w-4" />}
          right={<Badge color={SEVERITY_COLORS[fireState.severity] || "#22c55e"}>{fireState.severity || "Normal"}</Badge>}
        >
          <SpacecraftMap layout={layout} state={fireState} />
          {snapshot?.ai_assessment && (
            <div className="mt-3 rounded-lg border border-ion-500/30 bg-ion-500/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-ion-300">
                <Sparkles className="h-3.5 w-3.5" /> Live AI Intelligence Summary
              </div>
              <p className="mt-1 text-mist-300">{snapshot.ai_assessment.situation_summary}</p>
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmSuppression}
        title="Arm Scripted Suppression Scenario"
        confirmLabel="Arm Scenario 05 (Simulated)"
        message="Scenario 05 runs an electrical fire simulation and automatically triggers simulated suppressant activation at t=15s. Confirm simulated suppression demonstration?"
        warning="All actuator commands remain simulation-only; no physical hardware is actuated."
        onConfirm={confirmAndSelectSuppression}
        onCancel={() => setConfirmSuppression(false)}
      />
    </div>
  );
}

