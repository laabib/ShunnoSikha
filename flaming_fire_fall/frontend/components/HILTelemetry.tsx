"use client";

import React, { useEffect, useState } from "react";
import { Cpu, Copy, Check, Radio, Cable, CircuitBoard, Terminal } from "lucide-react";
import { api } from "@/lib/api";
import { TelemetryFrame } from "@/lib/useTelemetry";
import { useSensors } from "@/lib/sensors";
import { Panel, Badge } from "./ui";

export default function HILTelemetry({ frame, connected }: { frame: TelemetryFrame | null; connected: boolean }) {
  const { snapshot } = useSensors();
  const [board, setBoard] = useState<"uno" | "esp32">("uno");
  const [firmware, setFirmware] = useState("");
  const [copied, setCopied] = useState(false);
  const [scenarios, setScenarios] = useState<any>({});

  useEffect(() => {
    api.firmware(board).then((d) => setFirmware(d.cpp_code)).catch(() => {});
  }, [board]);

  useEffect(() => {
    api.scenarios().then((d) => setScenarios(d.scenarios)).catch(() => {});
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(firmware);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const health = frame?.sensor_health || {};
  const hw = snapshot?.hardware || {};
  const isSim = snapshot?.mode !== "live";
  const commErrors: any[] = Array.isArray(hw.communication_errors) ? hw.communication_errors : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Hardware / Virtual Sensor Node" icon={<Cpu className="h-4 w-4" />}>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-pulse-500/40 bg-pulse-500/10">
              <CircuitBoard className="h-7 w-7 text-pulse-400" />
            </div>
            <div>
              <div className="metric-num text-sm font-bold text-mist-100">
                {isSim ? frame?.device_id || "SIM-UNO-01" : hw.device_id || "NO HARDWARE"}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge color={isSim ? "#fbbf24" : hw.connected ? "#22d3ee" : "#ef4444"} pulse={connected}>
                  {isSim ? "SIMULATION MODE" : String(hw.status || "disconnected").toUpperCase()}
                </Badge>
                {!isSim && <Badge color="#22d3ee">{hw.frequency_hz ?? 0} Hz</Badge>}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {Object.entries(health).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-md border border-line bg-void-900/60 px-2.5 py-1.5 text-[11px]">
                <span className="text-mist-400">{k.replace(/_/g, " ")}</span>
                <span className="metric-num text-pulse-400">{String(v)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Active Scenario & Gateway Metrics" icon={<Radio className="h-4 w-4" />} className="lg:col-span-2">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
            <div className="rounded-lg border border-line bg-void-900/60 p-2.5">
              <div className="text-[10px] text-mist-500">Board</div>
              <div className="mt-0.5 font-mono font-semibold text-mist-100">{hw.board || "Arduino Uno"}</div>
            </div>
            <div className="rounded-lg border border-line bg-void-900/60 p-2.5">
              <div className="text-[10px] text-mist-500">Last Packet</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-mist-200">{hw.last_received_at || "—"}</div>
            </div>
            <div className="rounded-lg border border-line bg-void-900/60 p-2.5">
              <div className="text-[10px] text-mist-500">Incoming Hz</div>
              <div className="mt-0.5 font-mono font-semibold text-cyan-300">{hw.frequency_hz ?? 0} Hz</div>
            </div>
            <div className="rounded-lg border border-line bg-void-900/60 p-2.5">
              <div className="text-[10px] text-mist-500">Comm Errors</div>
              <div className="mt-0.5 font-mono font-semibold text-amber-300">{commErrors.length}</div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(scenarios).map(([key, s]: [string, any]) => (
              <div
                key={key}
                className={`rounded-lg border p-3 ${
                  frame?.scenario === key ? "border-ember-500/60 bg-ember-500/10" : "border-line bg-void-900/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${frame?.scenario === key ? "bg-ember-400 animate-pulse-dot" : "bg-mist-600"}`} />
                  <span className="text-xs font-semibold text-mist-100">{s.name}</span>
                </div>
                <div className="metric-num mt-1.5 grid grid-cols-3 gap-1 text-[10px] text-mist-500">
                  <span>O₂ {s.base_o2}%</span>
                  <span>u {s.base_flow} cm/s</span>
                  <span>CO {s.base_co} ppm</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-mist-500">
            Switch scenarios from Mission Control, adjust individual sensors in the 3D Arduino Twin view, or bridge physical Arduino Uno hardware via the USB serial gateway.
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel
          title={`Reference Firmware · ${board === "uno" ? "Arduino Uno" : "ESP32"}`}
          icon={<Terminal className="h-4 w-4" />}
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBoard("uno")}
                className={`chip ${board === "uno" ? "!border-cyan-400/60 !text-cyan-300" : ""}`}
              >
                Arduino Uno
              </button>
              <button
                type="button"
                onClick={() => setBoard("esp32")}
                className={`chip ${board === "esp32" ? "!border-cyan-400/60 !text-cyan-300" : ""}`}
              >
                ESP32
              </button>
              <button type="button" onClick={copy} className="btn !px-2.5 !py-1 text-[11px]">
                {copied ? <Check className="h-3.5 w-3.5 text-pulse-400" /> : <Copy className="h-3.5 w-3.5" />}{" "}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          }
        >
          <pre className="max-h-[420px] overflow-auto rounded-lg border border-line bg-void-950 p-4 font-mono text-[11px] leading-relaxed text-mist-300">
            {firmware || "Loading firmware…"}
          </pre>
        </Panel>

        <div className="space-y-4">
          <Panel title="USB Serial Hardware Gateway" icon={<Cable className="h-4 w-4" />}>
            <ol className="space-y-2.5 text-xs text-mist-300">
              {[
                "Flash hardware/arduino_uno/arduino_uno.ino (or your calibrated sensor sketch emitting JSON lines at 115200 baud).",
                "List connected USB ports: python3 -m shunnoshikha.serial_gateway --list",
                'Run gateway: python3 -m shunnoshikha.serial_gateway --port <PORT> --board "Arduino Uno"',
                "Switch the dashboard top bar to LIVE HARDWARE mode to inspect live serial packets.",
                "Live hardware actuation remains locked; suppression controls stay simulation-only without validated interlocks.",
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ember-500/20 text-[10px] font-bold text-ember-400">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Current Unified Telemetry Packet" icon={<Radio className="h-4 w-4" />}>
            <pre className="max-h-48 overflow-auto rounded-lg border border-line bg-void-950 p-3 font-mono text-[10px] leading-relaxed text-ion-300">
              {frame ? JSON.stringify(frame.telemetry, null, 2) : "Awaiting telemetry…"}
            </pre>
          </Panel>
        </div>
      </div>
    </div>
  );
}
