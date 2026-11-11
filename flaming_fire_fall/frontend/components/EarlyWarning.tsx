"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Fan, Power, Wind, CheckCircle2, Siren, Lock } from "lucide-react";
import { api, TIER_COLORS } from "@/lib/api";
import { TelemetryFrame } from "@/lib/useTelemetry";
import { useSensors } from "@/lib/sensors";
import { Panel, Badge, ConfirmDialog } from "./ui";

const ACTIONS = [
  { code: "ACTION_NOMINAL_MAINTENANCE", label: "Nominal Maintenance", icon: <CheckCircle2 className="h-4 w-4" />, color: "#22c55e" },
  { code: "ACTION_BALANCED_MIXING", label: "Balanced Mixing", icon: <Wind className="h-4 w-4" />, color: "#fbbf24" },
  { code: "ACTION_ISOLATE_VENTILATION", label: "Isolate Ventilation", icon: <Fan className="h-4 w-4" />, color: "#f97316" },
  { code: "ACTION_EMERGENCY_SHUTDOWN", label: "Emergency Shutdown", icon: <Power className="h-4 w-4" />, color: "#ef4444" },
];

export default function EarlyWarning({ frame }: { frame: TelemetryFrame | null }) {
  const { snapshot, refresh } = useSensors();
  const [limits, setLimits] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, setPending] = useState<(typeof ACTIONS)[number] | null>(null);

  useEffect(() => {
    api.safetyLimits().then(setLimits).catch(() => {});
  }, [snapshot?.revision]);

  const execute = async (code: string) => {
    setBusy(code);
    setErr("");
    setPending(null);
    try {
      const res = await api.hvacSuppress(code, true);
      setResult(res);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const isSim = snapshot?.mode !== "live";
  const safety = frame?.safety;
  const tier = safety?.safety_tier || (isSim ? "NORMAL" : "UNKNOWN");
  const color = TIER_COLORS[tier] || "#8b99b5";
  const t = frame?.telemetry;
  const l = limits?.limits;

  const limitRows = l
    ? [
        { k: "CO Caution (7-day SMAC)", v: l.co_caution_ppm, unit: "ppm", cur: t?.co_ppm, warn: t?.co_ppm != null && t.co_ppm >= l.co_caution_ppm },
        { k: "CO Warning (24-hr SMAC)", v: l.co_warning_ppm, unit: "ppm", cur: t?.co_ppm, warn: t?.co_ppm != null && t.co_ppm >= l.co_warning_ppm },
        { k: "CO Critical (Immediate)", v: l.co_critical_ppm, unit: "ppm", cur: t?.co_ppm, warn: t?.co_ppm != null && t.co_ppm >= l.co_critical_ppm },
        { k: "O₂ Nominal Upper", v: l.o2_max_nominal_pct, unit: "%", cur: t?.o2_concentration_pct, warn: t?.o2_concentration_pct != null && t.o2_concentration_pct >= l.o2_max_nominal_pct },
        { k: "O₂ High Flammability", v: l.o2_high_risk_pct, unit: "%", cur: t?.o2_concentration_pct, warn: t?.o2_concentration_pct != null && t.o2_concentration_pct >= l.o2_high_risk_pct },
        { k: "Stagnant Flow Threshold", v: l.min_flow_stagnant_cms, unit: "cm/s", cur: t?.airflow_velocity_cms, warn: t?.airflow_velocity_cms != null && t.airflow_velocity_cms <= l.min_flow_stagnant_cms },
        { k: "Cabin Temp Warning", v: l.temp_warning_C, unit: "°C", cur: t?.cabin_temp_C, warn: t?.cabin_temp_C != null && t.cabin_temp_C >= l.temp_warning_C },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-4 p-5" style={{ borderColor: `${color}55` }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-xl" style={{ background: `${color}22`, border: `1px solid ${color}66` }}>
          <Siren className="h-7 w-7" style={{ color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-extrabold" style={{ color }}>
              {tier}
            </span>
            <Badge color={isSim ? "#fbbf24" : "#22d3ee"}>{isSim ? "SIMULATION" : "LIVE HARDWARE"}</Badge>
          </div>
          <div className="text-xs text-mist-500">
            Configurable spacecraft reference bands · Severity {safety?.severity_score ?? "—"}/100
          </div>
        </div>
        <div className="flex gap-1.5">
          {["NORMAL", "CAUTION", "WARNING", "CRITICAL"].map((tt) => (
            <div key={tt} className="flex flex-col items-center gap-1">
              <div
                className="h-2.5 w-12 rounded-full transition-all"
                style={{
                  background: tt === tier ? TIER_COLORS[tt] : "#1b2742",
                  boxShadow: tt === tier ? `0 0 10px ${TIER_COLORS[tt]}` : "none",
                }}
              />
              <span className="text-[8px] font-semibold" style={{ color: tt === tier ? TIER_COLORS[tt] : "#475569" }}>
                {tt}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Engineering Safety Thresholds" icon={<ShieldAlert className="h-4 w-4" />}>
          <div className="space-y-1.5">
            {limitRows.map((r) => (
              <div
                key={r.k}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  r.warn ? "border-flame-500/40 bg-flame-500/5" : "border-line bg-void-900/60"
                }`}
              >
                <span className="text-xs text-mist-300">{r.k}</span>
                <div className="flex items-center gap-3">
                  <span className="metric-num text-[11px] text-mist-500">
                    limit {r.v}
                    {r.unit}
                  </span>
                  <span className="metric-num text-xs font-bold" style={{ color: r.cur == null ? "#64748b" : r.warn ? "#ef4444" : "#4ade80" }}>
                    {r.cur != null ? r.cur.toFixed(1) : "—"}
                    {r.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Automated HVAC Suppression Commands"
            icon={<Fan className="h-4 w-4" />}
            right={!isSim && <Badge color="#ef4444">LIVE LOCKED</Badge>}
          >
            {!isSim && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-flame-500/40 bg-flame-500/10 px-3 py-2 text-xs text-flame-300">
                <Lock className="h-4 w-4 shrink-0" />
                Real hardware actuation is disabled without a validated safety controller and hardware interlocks.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => setPending(a)}
                  disabled={!!busy || !isSim}
                  className="flex items-center gap-2 rounded-lg border p-3 text-left text-xs font-semibold transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: `${a.color}55`, background: `${a.color}12`, color: a.color }}
                >
                  {busy === a.code ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : !isSim ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    a.icon
                  )}
                  {a.label}
                </button>
              ))}
            </div>
            {err && <div className="mt-3 rounded-lg border border-flame-500/50 bg-flame-500/10 px-3 py-2 text-xs text-flame-400">{err}</div>}
            {result && (
              <div className="mt-3 rounded-lg border border-pulse-500/40 bg-pulse-500/5 p-3 animate-fade-up">
                <Badge color="#4ade80" pulse>
                  {result.execution_status}
                </Badge>
                <p className="mt-2 text-xs text-mist-300">{result.confirmation}</p>
                <div className="metric-num mt-1 text-[10px] text-mist-500">Action: {result.action_executed}</div>
              </div>
            )}
          </Panel>

          <Panel title="Crew Emergency Protocol" icon={<Siren className="h-4 w-4" />}>
            <p className="text-sm leading-relaxed text-mist-300">{safety?.crew_emergency_protocol || "Routine mission monitoring."}</p>
            {safety?.rule_violations?.length ? (
              <div className="mt-3 space-y-1.5">
                {safety.rule_violations.map((v, i) => (
                  <div key={i} className="flex gap-2 rounded-md border border-flame-500/30 bg-flame-500/5 px-2.5 py-1.5 text-[11px] text-flame-400">
                    <span>⚠</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        danger
        title={pending?.label || ""}
        confirmLabel="Confirm (Simulated)"
        message={`Confirm simulated execution of "${pending?.label}"? No physical hardware or spacecraft HVAC system will be commanded.`}
        onConfirm={() => pending && void execute(pending.code)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
