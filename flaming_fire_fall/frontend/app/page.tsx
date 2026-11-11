"use client";

import React, { useEffect, useState } from "react";
import {
  Activity, Bot, Flame, Brain, Eye, Globe, Database, Lightbulb, Cpu, ShieldAlert,
  Menu, X, Rocket, Radio, Siren, CircuitBoard, MonitorPlay,
} from "lucide-react";
import { useTelemetry } from "@/lib/useTelemetry";
import { useSensors } from "@/lib/sensors";
import { api, TIER_COLORS } from "@/lib/api";
import MissionControl from "@/components/MissionControl";
import HardwareDigitalTwin from "@/components/hardware/HardwareDigitalTwin";
import PresentationMode from "@/components/fire/PresentationMode";
import AICommand from "@/components/AICommand";
import DigitalTwin from "@/components/DigitalTwin";
import MLExplain from "@/components/MLExplain";
import FlameVision from "@/components/FlameVision";
import NasaRag from "@/components/NasaRag";
import MetadataHub from "@/components/MetadataHub";
import HypothesisLab from "@/components/HypothesisLab";
import HILTelemetry from "@/components/HILTelemetry";
import EarlyWarning from "@/components/EarlyWarning";
import FireConsole from "@/components/fire/FireConsole";

const NAV = [
  { id: "mission", label: "Mission Control", icon: Activity, module: "MAIN", desc: "3D twin · telemetry · status" },
  { id: "arduino", label: "3D Arduino Twin", icon: CircuitBoard, module: "3D", desc: "Mode A/B · pins · sliders" },
  { id: "fire", label: "Fire Emergency", icon: Siren, module: "M9", desc: "Spread · suppression · crew" },
  { id: "presentation", label: "Presentation Mode", icon: MonitorPlay, module: "DEMO", desc: "5 judge scenarios" },
  { id: "ai", label: "AI Command", icon: Bot, module: "M5", desc: "5-agent super-intelligence" },
  { id: "rag", label: "NASA Live RAG", icon: Globe, module: "RAG", desc: "Live web retrieval" },
  { id: "twin", label: "Combustion Twin", icon: Flame, module: "M2", desc: "3-regime boundary" },
  { id: "ml", label: "SHAP ML Engine", icon: Brain, module: "M3", desc: "Explainable prediction" },
  { id: "vision", label: "Flame Vision", icon: Eye, module: "M4", desc: "Optical kinematics" },
  { id: "metadata", label: "Metadata Hub", icon: Database, module: "M1", desc: "PSI ranker" },
  { id: "hypothesis", label: "Hypothesis Lab", icon: Lightbulb, module: "M6", desc: "Experiment designer" },
  { id: "hil", label: "HIL Gateway", icon: Cpu, module: "M7", desc: "Serial & firmware" },
  { id: "warning", label: "Early Warning", icon: ShieldAlert, module: "M8", desc: "4-tier alerts" },
];

export default function Home() {
  const [view, setView] = useState("mission");
  const [navOpen, setNavOpen] = useState(false);
  const [clock, setClock] = useState("");
  const [aiMode, setAiMode] = useState("…");
  const { snapshot, setMode } = useSensors();
  const { frame, history, connected, series } = useTelemetry(60);

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().split("T")[1].replace("Z", " UTC"));
    tick();
    const iv = setInterval(tick, 1000);
    api.aiStatus().then((d) => setAiMode(d.mode)).catch(() => setAiMode("OFFLINE"));
    return () => clearInterval(iv);
  }, []);

  const active = NAV.find((n) => n.id === view) || NAV[0];
  const isSim = snapshot?.mode !== "live";
  const hw = snapshot?.hardware || {};
  const fireState = snapshot?.fire_state || {};
  const tier = frame?.safety?.safety_tier || (isSim ? "NORMAL" : "UNKNOWN");
  const tierColor = TIER_COLORS[tier] || "#8b99b5";
  const commErrorCount = Array.isArray(hw.communication_errors) ? hw.communication_errors.length : 0;

  const go = (id: string) => {
    setView(id);
    setNavOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {navOpen && <div className="fixed inset-0 z-30 bg-void-950/70 backdrop-blur-sm lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col border-r border-line bg-void-900/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ember-600 to-flame-600 shadow-glow">
            <Flame className="h-6 w-6 text-void-950" />
            <span className="absolute inset-0 rounded-xl bg-ember-500/30 blur-md animate-pulse-dot" />
          </div>
          <div>
            <div className="font-display text-[15px] font-extrabold tracking-wide text-mist-100">
              SHUNNO<span className="text-ember-400">SHIKHA</span>
            </div>
            <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-mist-500">AI · Flame in Freefall</div>
          </div>
          <button type="button" onClick={() => setNavOpen(false)} className="ml-auto text-mist-500 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = view === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-ember-500/20 to-transparent border border-ember-500/40 shadow-glow"
                    : "border border-transparent hover:bg-void-700/60"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-ember-400" : "text-mist-500 group-hover:text-mist-300"}`} />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[13px] font-semibold ${isActive ? "text-mist-100" : "text-mist-300"}`}>{n.label}</div>
                  <div className="truncate text-[9px] text-mist-600">{n.desc}</div>
                </div>
                <span
                  className={`metric-num rounded px-1.5 py-0.5 text-[8px] font-bold ${
                    isActive ? "bg-ember-500/20 text-ember-300" : "bg-void-800 text-mist-600"
                  }`}
                >
                  {n.module}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-line px-5 py-3">
          <div className="flex items-center gap-2 text-[10px] text-mist-500">
            <Rocket className="h-3.5 w-3.5 text-ember-500" />
            <span>Team HASH · NASA Space Apps</span>
          </div>
          <div className="mt-1 text-[9px] text-mist-600">Search · Simulate · Track · Reason · Verify · Monitor · Alert</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: Operating mode, Arduino status, System health, Emergency level */}
        <header className="flex flex-wrap items-center gap-2.5 border-b border-line bg-void-900/80 px-4 py-3 backdrop-blur-xl lg:px-6">
          <button type="button" onClick={() => setNavOpen(true)} className="text-mist-400 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 mr-2">
            <h1 className="font-display truncate text-base font-bold tracking-wide text-mist-100">{active.label}</h1>
            <p className="truncate text-[10px] text-mist-500">{active.desc}</p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* 1. Prominent Operating Mode Selector */}
            <div className="flex items-center rounded-full border border-line bg-void-950 p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => void setMode("simulation")}
                className={`rounded-full px-2.5 py-1 transition-all ${
                  isSim ? "bg-amber-500/20 text-amber-300" : "text-mist-500 hover:text-mist-300"
                }`}
              >
                SIMULATION
              </button>
              <button
                type="button"
                onClick={() => void setMode("live")}
                className={`rounded-full px-2.5 py-1 transition-all ${
                  !isSim ? "bg-cyan-500/20 text-cyan-300" : "text-mist-500 hover:text-mist-300"
                }`}
              >
                LIVE HW
              </button>
            </div>

            {/* 2. Arduino Connection Status */}
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                isSim
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : hw.connected
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              }`}
            >
              <CircuitBoard className="h-3 w-3" />
              <span className="hidden sm:inline">
                {isSim ? "UNO: VIRTUAL" : hw.connected ? `UNO: LIVE (${hw.frequency_hz ?? 0}Hz)` : `UNO: ${String(hw.status || "OFFLINE").toUpperCase()}`}
              </span>
            </span>

            {/* 3. System Health */}
            <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold text-mist-300">
              <Radio className={`h-3 w-3 ${connected ? "text-pulse-400" : "text-flame-500"}`} />
              <span className="hidden md:inline">
                {connected ? (commErrorCount > 0 ? `LINK OK (${commErrorCount} err)` : "SYS HEALTHY") : "NO LINK"}
              </span>
            </span>

            {/* 4. Emergency Level */}
            <span
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
              style={{ borderColor: `${tierColor}55`, color: tierColor, background: `${tierColor}12` }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: tierColor }} />
              {tier}
              {(fireState.detected || fireState.possible_fire) && <span className="text-rose-400">· FIRE</span>}
            </span>

            <span className="hidden items-center gap-1.5 rounded-full border border-nova-500/40 bg-nova-500/10 px-2.5 py-1 text-[10px] font-semibold text-nova-400 xl:flex">
              <Bot className="h-3 w-3" />
              {aiMode.includes("LLM") ? "LLM" : "RULES"}
            </span>
            <span className="metric-num hidden text-xs text-mist-400 2xl:block">{clock}</span>
          </div>
        </header>

        {/* Content */}
        <main className={`min-h-0 flex-1 overflow-y-auto ${view === "ai" ? "" : "p-4 lg:p-6"}`}>
          {view === "mission" && (
            <MissionControl frame={frame} history={history} connected={connected} series={series} onNavigate={go} />
          )}
          {view === "arduino" && <HardwareDigitalTwin onNavigate={go} />}
          {view === "fire" && <FireConsole />}
          {view === "presentation" && <PresentationMode />}
          {view === "ai" && <AICommand />}
          {view === "rag" && <NasaRag />}
          {view === "twin" && <DigitalTwin />}
          {view === "ml" && <MLExplain />}
          {view === "vision" && <FlameVision />}
          {view === "metadata" && <MetadataHub />}
          {view === "hypothesis" && <HypothesisLab />}
          {view === "hil" && <HILTelemetry frame={frame} connected={connected} />}
          {view === "warning" && <EarlyWarning frame={frame} />}
        </main>
      </div>
    </div>
  );
}
