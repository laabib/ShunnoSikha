"use client";

import React, { useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import { Panel, Badge, Sparkline } from "../ui";
import { fireApi, SPECIES_COLORS } from "@/lib/fire";
import { useSensors } from "@/lib/sensors";

const STATUS_COLOR: Record<string, string> = {
  OK: "#22c55e",
  CAUTION: "#fbbf24",
  WARNING: "#f97316",
  CRITICAL: "#ef4444",
  UNKNOWN: "#8b99b5",
};

export default function AtmosphereMonitor({ state, refresh }: { state: any; refresh: () => void }) {
  const { snapshot } = useSensors();
  const th = state?.thresholds || {};
  const atm = state?.atmosphere || {};
  const sensors = snapshot?.sensors || {};
  const crew = state?.crew?.species_status || {};
  const hist = state?.history || [];
  const [sel, setSel] = useState("o2_pct");
  const [draft, setDraft] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const openEditor = (key: string) => {
    setSel(key);
    setDraft(JSON.parse(JSON.stringify(th[key])));
    setSaved(false);
    setErr("");
  };
  const setBand = (band: string, idx: number, v: number) =>
    setDraft((d: any) => ({ ...d, [band]: d[band].map((x: number, i: number) => (i === idx ? v : x)) }));
  const save = () => {
    setErr("");
    fireApi
      .setThresholds({ [sel]: draft })
      .then(() => {
        setSaved(true);
        refresh();
      })
      .catch((e) => setErr(e.message));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(th).map(([key, t]: [string, any]) => {
          const val = atm[key];
          const sensorInfo = sensors[key] || {};
          const prevVal = sensorInfo.previous_value;
          const st = crew[key] || "UNKNOWN";
          const sensorStatus = sensorInfo.status || "missing";
          const color = SPECIES_COLORS[key] || "#22d3ee";
          const hasVal = typeof val === "number" && Number.isFinite(val);
          const hasPrev = typeof prevVal === "number" && Number.isFinite(prevVal);
          const critSpan = Math.max(0.001, t.crit[1] - t.crit[0]);
          const gaugePct = hasVal ? Math.max(0, Math.min(100, ((val - t.crit[0]) / critSpan) * 100)) : 0;
          const sparkSeries = hist.map((h: any) => h[key]).filter((x: any) => typeof x === "number" && Number.isFinite(x));

          return (
            <button
              key={key}
              type="button"
              onClick={() => openEditor(key)}
              className="panel p-3 text-left transition-all hover:border-line-bright"
              style={{ borderColor: st !== "OK" ? `${STATUS_COLOR[st] || "#8b99b5"}66` : undefined }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-mist-400">
                  {t.label} <span className="font-mono text-mist-600">({sensorInfo.pin || "—"})</span>
                </span>
                <Badge color={STATUS_COLOR[st] || "#8b99b5"}>{st}</Badge>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <div className="metric-num text-2xl font-bold" style={{ color: hasVal ? color : "#64748b" }}>
                  {hasVal ? val.toFixed(key === "co2_ppm" ? 0 : 2) : "—"}
                  <span className="ml-1 text-xs font-normal text-mist-500">{t.unit}</span>
                </div>
                <div className="metric-num text-[10px] text-mist-500">
                  prev {hasPrev ? prevVal.toFixed(key === "co2_ppm" ? 0 : 2) : "—"}
                </div>
              </div>

              {/* Live threshold gauge bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-void-900">
                {hasVal && (
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${gaugePct}%`, background: STATUS_COLOR[st] || color }}
                  />
                )}
              </div>

              {sparkSeries.length > 1 && (
                <div className="mt-2">
                  <Sparkline data={sparkSeries} color={color} height={30} />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-[9px] text-mist-500">
                <span>
                  Norm {t.normal[0]}–{t.normal[1]} · Crit {t.crit[0]}–{t.crit[1]}
                </span>
                <span className="font-mono uppercase text-mist-400">{sensorStatus}</span>
              </div>
            </button>
          );
        })}

        {/* Ventilation Airflow Channel Card */}
        {sensors.airflow_cms && (
          <div className="panel p-3 text-left">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-mist-400">
                Ventilation <span className="font-mono text-mist-600">({sensors.airflow_cms.pin})</span>
              </span>
              <Badge color={sensors.airflow_cms.status === "normal" ? "#22c55e" : "#fbbf24"}>
                {String(sensors.airflow_cms.status || "missing").toUpperCase()}
              </Badge>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <div className="metric-num text-2xl font-bold text-sky-400">
                {typeof sensors.airflow_cms.value === "number" ? sensors.airflow_cms.value.toFixed(2) : "—"}
                <span className="ml-1 text-xs font-normal text-mist-500">cm/s</span>
              </div>
              <div className="metric-num text-[10px] text-mist-500">
                prev {typeof sensors.airflow_cms.previous_value === "number" ? sensors.airflow_cms.previous_value.toFixed(2) : "—"}
              </div>
            </div>
            {hist.filter((h: any) => typeof h.airflow_cms === "number").length > 1 && (
              <div className="mt-2">
                <Sparkline
                  data={hist.map((h: any) => h.airflow_cms).filter((x: any) => typeof x === "number")}
                  color="#38bdf8"
                  height={30}
                />
              </div>
            )}
            <div className="mt-2 text-[9px] text-mist-500">Governs microgravity flame survival & blowoff boundary</div>
          </div>
        )}
      </div>

      <Panel
        title="Configurable Spacecraft Reference Thresholds"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        right={<span className="text-[10px] text-mist-500">click any species card above or select below</span>}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <span className="label">Species</span>
            <select value={sel} onChange={(e) => openEditor(e.target.value)} className="input">
              {Object.entries(th).map(([k, t]: [string, any]) => (
                <option key={k} value={k}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {draft &&
            ["normal", "warn", "crit"].map((band) => (
              <div key={band}>
                <span className="label">{band} low / high</span>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    value={draft[band][0]}
                    onChange={(e) => setBand(band, 0, parseFloat(e.target.value))}
                    className="input !w-24 !py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={draft[band][1]}
                    onChange={(e) => setBand(band, 1, parseFloat(e.target.value))}
                    className="input !w-24 !py-1.5 text-xs"
                  />
                </div>
              </div>
            ))}
          <button type="button" onClick={save} className="btn btn-primary">
            <Save className="h-4 w-4" /> Save Thresholds
          </button>
          {saved && <Badge color="#4ade80">Saved</Badge>}
        </div>
        {err && <div className="mt-2 text-xs text-flame-400">{err}</div>}
        <p className="mt-3 text-[10px] leading-relaxed text-mist-500">
          Values outside the normal band raise CAUTION; outside warn raise WARNING; outside crit raise CRITICAL. Thresholds are spacecraft-configurable rather than assumed universal Earth limits.
        </p>
      </Panel>
    </div>
  );
}
