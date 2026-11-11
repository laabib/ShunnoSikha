"use client";

import React from "react";
import { MapPin, Clock } from "lucide-react";
import { Panel, Stat, Badge } from "../ui";
import SpacecraftMap from "./SpacecraftMap";
import { SEVERITY_COLORS } from "@/lib/fire";

export default function FireMonitoring({ state, layout }: { state: any; layout: any }) {
  const f = state?.fire || {};
  const isLive = state?.data_source === "LIVE_HARDWARE";
  const sev = state?.severity || (isLive ? "Unknown" : "Normal");
  const sc = SEVERITY_COLORS[sev] || "#8b99b5";
  const timelineTypes = [
    "ignition",
    "fire_detected",
    "fire_spread",
    "suppression_activation",
    "emergency_isolation",
    "oxygen_isolation",
    "compartment_extinguished",
    "fire_extinguished",
    "connection",
    "communication_error",
    "crew_status_change",
    "command_blocked",
  ];
  const timeline = (state?.events || []).filter((e: any) => timelineTypes.includes(e.type));
  const fmt = (v: any, digits = 2) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—");

  return (
    <div className="stagger space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Detection Status"
          value={
            <Badge color={state?.detected || state?.possible_fire ? "#ef4444" : isLive ? "#8b99b5" : "#22c55e"} pulse={!!state?.detected || !!state?.possible_fire}>
              {isLive
                ? state?.possible_fire
                  ? "POSSIBLE SIGNATURE"
                  : "UNCLASSIFIED (LIVE)"
                : state?.detected
                ? "FIRE DETECTED"
                : "MONITORING"}
            </Badge>
          }
        />
        <Stat label="Fire Location" value={f.location || "—"} accent="#fbbf24" sub={state?.fire_type?.name} />
        <Stat label="Severity / Emergency" value={<span style={{ color: sc }}>{sev}</span>} accent={sc} />
        <Stat label="Smoke Density" value={fmt(state?.atmosphere?.smoke_mgm3, 2)} unit="mg/m³" accent="#8b99b5" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Intensity" value={fmt(f.total_intensity, 2)} accent="#f97316" />
        <Stat label="Growth Rate" value={fmt(f.growth_rate, 3)} unit="/s" accent="#e879f9" />
        <Stat label="Spread Dir." value={f.spread_direction || "—"} accent="#60a5fa" />
        <Stat label="Propagation" value={fmt(f.propagation_speed_mms, 2)} unit="mm/s" accent="#22d3ee" />
        <Stat label="Duration" value={fmt(f.duration_s, 1)} unit="s" accent="#fbbf24" />
        <Stat label="Affected Area" value={fmt(f.affected_area_m2, 1)} unit="m²" accent="#ef4444" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel
          title={isLive ? "Spacecraft Layout · Live Sensors Do Not Map Fire Location" : "Spacecraft Layout · Live Fire Map"}
          icon={<MapPin className="h-4 w-4" />}
          right={
            <Badge color={sc} pulse>
              {sev}
            </Badge>
          }
        >
          <SpacecraftMap layout={layout} state={state} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-md border border-line bg-void-900 px-2.5 py-1.5">
              <span className="text-mist-500">Burning: </span>
              <span className="metric-num text-flame-400">{(f.burning || []).join(", ") || "none"}</span>
            </div>
            <div className="rounded-md border border-line bg-void-900 px-2.5 py-1.5">
              <span className="text-mist-500">Affected: </span>
              <span className="metric-num text-ember-400">{(f.affected || []).join(", ") || "none"}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Fire & Hardware Event Timeline" icon={<Clock className="h-4 w-4" />}>
          <div className="relative space-y-0 pl-4 max-h-[300px] overflow-auto">
            <div className="absolute left-[5px] top-1 bottom-1 w-px bg-line" />
            {timeline.length === 0 && (
              <div className="py-4 text-xs text-mist-500">No fire events. Start a simulation or stream hardware packets to populate the timeline.</div>
            )}
            {timeline.map((e: any, i: number) => (
              <div key={i} className="relative pb-3">
                <span
                  className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full border-2 border-void-850"
                  style={{ background: e.severity === "critical" ? "#ef4444" : e.severity === "warning" ? "#fbbf24" : "#22d3ee" }}
                />
                <div className="metric-num text-[10px] text-mist-500">t={e.t}s</div>
                <div className="text-xs text-mist-300">{e.message}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2 text-center text-[10px]">
            <div>
              <div className="text-mist-500">Ignition</div>
              <div className="metric-num text-ember-400">{state?.ignition_time ?? "—"}s</div>
            </div>
            <div>
              <div className="text-mist-500">Detection</div>
              <div className="metric-num text-flame-400">{state?.detection_time ?? "—"}s</div>
            </div>
            <div>
              <div className="text-mist-500">Extinguish</div>
              <div className="metric-num text-pulse-400">{state?.extinguish_time ?? "—"}s</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
