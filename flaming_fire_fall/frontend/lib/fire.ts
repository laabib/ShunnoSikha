"use client";

import { useSensors } from "./sensors";
import { API_URL } from "./api";

export const SEVERITY_COLORS: Record<string, string> = {
  Normal: "#22c55e",
  Warning: "#fbbf24",
  Critical: "#f97316",
  Extreme: "#ef4444",
  Unknown: "#8b99b5",
};
export const CREW_COLORS: Record<string, string> = {
  SAFE: "#22c55e",
  CAUTION: "#fbbf24",
  DANGER: "#f97316",
  CRITICAL: "#ef4444",
  UNKNOWN: "#8b99b5",
};
export const SPECIES_COLORS: Record<string, string> = {
  o2_pct: "#22d3ee",
  co_ppm: "#f97316",
  co2_ppm: "#e879f9",
  temp_C: "#fbbf24",
  humidity_pct: "#60a5fa",
  smoke_mgm3: "#8b99b5",
  pressure_kpa: "#4ade80",
};

export function intensityColor(i: number): string {
  if (i < 0.02) return "#131c33";
  if (i < 0.25) return "#fbbf24";
  if (i < 0.5) return "#f97316";
  if (i < 0.75) return "#ef4444";
  return "#e879f9";
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API_URL + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail || msg);
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const fireApi = {
  layout: () => req<any>("/api/fire/layout"),
  scenarios: () => req<any>("/api/fire/scenarios"),
  state: () => req<any>("/api/fire/state"),
  config: (b: any) => req<any>("/api/fire/config", { method: "POST", body: JSON.stringify(b) }),
  start: () => req<any>("/api/fire/start", { method: "POST" }),
  pause: () => req<any>("/api/fire/pause", { method: "POST" }),
  stop: () => req<any>("/api/fire/stop", { method: "POST" }),
  reset: () => req<any>("/api/fire/reset", { method: "POST" }),
  speed: (speed: number) => req<any>("/api/fire/speed", { method: "POST", body: JSON.stringify({ speed }) }),
  recommendation: () => req<any>("/api/fire/suppression/recommendation"),
  suppress: (action: string, confirmed: boolean) =>
    req<any>("/api/fire/suppression", { method: "POST", body: JSON.stringify({ action, confirmed }) }),
  thresholds: () => req<any>("/api/fire/thresholds"),
  setThresholds: (t: any) => req<any>("/api/fire/thresholds", { method: "POST", body: JSON.stringify({ thresholds: t }) }),
  crew: () => req<any>("/api/fire/crew"),
  aiAssessment: () => req<any>("/api/fire/ai-assessment", { method: "POST" }),
  events: () => req<any>("/api/fire/events"),
  report: (format: "json" | "md") => req<any>(`/api/fire/report?format=${format}`),
  presentationSelect: (scenario: string, confirmed = false) =>
    req<any>("/api/presentation/select", { method: "POST", body: JSON.stringify({ scenario, confirmed }) }),
  presentationAction: (action: "start" | "pause" | "resume" | "reset") =>
    req<any>("/api/presentation/action", { method: "POST", body: JSON.stringify({ action }) }),
};

/** Centralized subscription: reads from SensorProvider (/ws/sensors) so there is a single source of truth. */
export function useFireSim() {
  const { snapshot, connected, refresh } = useSensors();
  return {
    state: snapshot?.fire_state || null,
    snapshot,
    connected,
    refresh: () => {
      void refresh();
    },
  };
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
