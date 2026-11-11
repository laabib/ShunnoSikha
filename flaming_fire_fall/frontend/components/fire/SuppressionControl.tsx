"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Droplets, SprayCan, Power, OctagonX, BellRing, Lock, CheckCircle2, Wind } from "lucide-react";
import { Panel, Badge, ConfirmDialog } from "../ui";
import { fireApi } from "@/lib/fire";
import { useSensors } from "@/lib/sensors";

const ACTIONS = [
  { id: "activate_suppression", label: "Activate Suppression System", icon: ShieldAlert, color: "#f97316", confirm: true },
  { id: "activate_water", label: "Activate Water System", icon: Droplets, color: "#60a5fa", confirm: true, water: true },
  { id: "activate_suppressant", label: "Activate Fire Suppressant", icon: SprayCan, color: "#e879f9", confirm: true },
  { id: "emergency_isolation", label: "Emergency Isolation", icon: Power, color: "#fbbf24", confirm: true },
  { id: "isolate_oxygen", label: "Isolate O₂ Source", icon: Wind, color: "#22d3ee", confirm: true },
  { id: "stop_suppression", label: "Stop Suppression", icon: OctagonX, color: "#8b99b5", confirm: false },
  { id: "emergency_alert", label: "Emergency Alert", icon: BellRing, color: "#ef4444", confirm: true },
];

export default function SuppressionControl({ state, refresh }: { state: any; refresh: () => void }) {
  const { snapshot } = useSensors();
  const [rec, setRec] = useState<any>(null);
  const [pending, setPending] = useState<any>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const isSim = snapshot?.mode !== "live";

  useEffect(() => {
    fireApi.recommendation().then(setRec).catch(() => {});
  }, [
    state?.config?.fire_type,
    state?.config?.water_approved,
    state?.config?.equipment_deenergized,
    state?.suppression?.o2_isolated,
    snapshot?.mode,
  ]);

  const fire = (a: any) => {
    setErr("");
    setOk("");
    fireApi
      .suppress(a.id, true)
      .then((res) => {
        setOk(`${a.label} executed (${res?.execution_status || "SIMULATED_ONLY"} · ${res?.command_id || "ack"}).`);
        refresh();
      })
      .catch((e) => setErr(e.message));
    setPending(null);
  };

  const toggleInterlock = (patch: Record<string, boolean>) => {
    setErr("");
    fireApi
      .config(patch)
      .then(refresh)
      .catch((e) => setErr(e.message));
  };

  const activations = (state?.events || []).filter((e: any) =>
    ["suppression_activation", "emergency_isolation", "oxygen_isolation", "suppression_stop", "emergency_alert", "command_blocked"].includes(e.type)
  );
  const waterAllowed = !!rec?.water_allowed;
  const lastAck = state?.command_acknowledgement;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Panel
          title="Recommended Suppression · Fire-Type Specific"
          icon={<ShieldAlert className="h-4 w-4" />}
          right={<Badge color={isSim ? "#fbbf24" : "#ef4444"}>{isSim ? "SIMULATION · CONFIRMATION REQUIRED" : "LIVE HARDWARE · ACTUATION LOCKED"}</Badge>}
        >
          {rec && (
            <>
              <div className="rounded-lg border border-ember-500/40 bg-ember-500/10 p-4">
                <div className="text-[10px] uppercase tracking-wider text-ember-400">
                  {rec.fire_name} · {rec.fire_class}
                </div>
                <div className="mt-1 text-sm font-semibold text-mist-100">{rec.recommended_method}</div>
                <p className="mt-2 text-xs leading-relaxed text-mist-400">{rec.reasoning}</p>
              </div>

              <div
                className="mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed"
                style={{
                  borderColor: waterAllowed ? "#4ade8055" : "#ef444455",
                  background: waterAllowed ? "#4ade8010" : "#ef444410",
                  color: waterAllowed ? "#4ade80" : "#ef4444",
                }}
              >
                {waterAllowed ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : <Lock className="mr-1 inline h-3.5 w-3.5" />}
                {rec.water_note}
              </div>

              {isSim && rec.water_compatible && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 rounded-lg border border-line bg-void-900/70 p-3 text-xs">
                  <label className="flex cursor-pointer items-center gap-2 text-mist-200">
                    <input
                      type="checkbox"
                      checked={!!state?.config?.equipment_deenergized}
                      onChange={(e) => toggleInterlock({ equipment_deenergized: e.target.checked })}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    <span>Procedure Check: Equipment De-energized</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-mist-200">
                    <input
                      type="checkbox"
                      checked={!!state?.config?.water_approved}
                      onChange={(e) => toggleInterlock({ water_approved: e.target.checked })}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    <span>Procedure Check: Water Mist Approved</span>
                  </label>
                </div>
              )}

              <div className="mt-3 space-y-1.5">
                {(rec.warnings || []).map((w: string, i: number) => (
                  <div key={i} className="flex gap-2 rounded-md border border-flame-500/30 bg-flame-500/5 px-2.5 py-1.5 text-[11px] text-flame-400">
                    <span>⚠</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Emergency Response Controls" icon={<Power className="h-4 w-4" />}>
          {!isSim && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-flame-500/40 bg-flame-500/10 px-3 py-2 text-xs text-flame-300">
              <Lock className="h-4 w-4 shrink-0" />
              LIVE ACTUATION LOCKED: Physical suppression equipment cannot be activated without a validated hardware controller and safety interlocks.
            </div>
          )}

          {state?.suppression?.active && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 animate-pulse">
              <span className="font-semibold">SUPPRESSION ACTIVE: {state.suppression.method}</span>
              <span className="font-mono text-[11px]">Intensity decaying…</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              const disabled = !isSim || (a.water && !waterAllowed);
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => (a.confirm ? setPending(a) : fire(a))}
                  title={!isSim ? "Live hardware actuation locked" : disabled ? "Water requires compatible fire type + approved procedure + de-energized equipment" : a.label}
                  className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-[11px] font-semibold transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: `${a.color}55`, background: `${a.color}12`, color: a.color }}
                >
                  {disabled ? <Lock className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  {a.label}
                </button>
              );
            })}
          </div>
          {err && <div className="mt-3 rounded-lg border border-flame-500/50 bg-flame-500/10 px-3 py-2 text-xs text-flame-400">{err}</div>}
          {ok && <div className="mt-3 rounded-lg border border-pulse-500/50 bg-pulse-500/10 px-3 py-2 text-xs text-pulse-400">{ok}</div>}
          <div className="mt-3 rounded-md border border-line bg-void-900 px-3 py-2 text-[10px] text-mist-500">
            Safety interlock: water is blocked for electrical, lithium-ion battery, and flammable liquid fires, and requires explicit de-energized + approved checks when compatible.
          </div>
        </Panel>
      </div>

      <Panel title="Suppression Status & Activation Log" icon={<BellRing className="h-4 w-4" />}>
        <div className="mb-3 space-y-2 rounded-lg border border-line bg-void-900 px-3 py-2 text-[11px]">
          <div>
            <span className="text-mist-500">Actuator State: </span>
            <span className="font-semibold text-ember-400">
              {isSim ? (state?.suppression?.active ? state.suppression.method : "idle (simulated)") : "LIVE ACTUATION LOCKED"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {state?.suppression?.isolated && <Badge color="#fbbf24">COMPARTMENTS ISOLATED</Badge>}
            {state?.suppression?.o2_isolated && <Badge color="#22d3ee">O₂ ISOLATED</Badge>}
          </div>
          {lastAck && (
            <div className="rounded border border-line/70 bg-void-950 p-2 font-mono text-[10px] text-mist-400">
              ACK {lastAck.id} · {lastAck.state?.toUpperCase()} · {lastAck.action}
            </div>
          )}
        </div>

        {activations.length === 0 ? (
          <div className="py-6 text-center text-xs text-mist-500">No suppression actions recorded.</div>
        ) : (
          <div className="max-h-[380px] space-y-2 overflow-auto">
            {activations
              .slice()
              .reverse()
              .map((e: any, i: number) => (
                <div key={i} className="rounded-lg border border-line bg-void-900/60 px-3 py-2">
                  <div className="metric-num text-[10px] text-mist-500">
                    t={e.t}s · {e.type}
                  </div>
                  <div className="mt-0.5 text-xs text-mist-300">{e.message}</div>
                </div>
              ))}
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={!!pending}
        danger
        title={pending?.label || ""}
        confirmLabel="Activate (Simulated)"
        message={`Confirm simulated activation of "${pending?.label}" for ${rec?.fire_name || "the current configuration"}? This records an emergency event; no real hardware is actuated.`}
        warning={pending?.water ? "Water compatibility & procedure interlocks verified for this simulation." : rec?.warnings?.[0]}
        onConfirm={() => fire(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
