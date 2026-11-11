import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: { 950: "#05070f", 900: "#070b16", 850: "#0a0f1e", 800: "#0e1526", 700: "#131c33", 600: "#1b2742" },
        line: { DEFAULT: "#1e2a47", bright: "#2c3d63" },
        ember: { 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#f97316", 700: "#ea580c" },
        flame: { 400: "#fb7185", 500: "#ef4444", 600: "#dc2626" },
        ion: { 300: "#67e8f9", 400: "#22d3ee", 500: "#06b6d4" },
        pulse: { 400: "#4ade80", 500: "#22c55e" },
        nova: { 400: "#e879f9", 500: "#d946ef" },
        volt: { 400: "#60a5fa", 500: "#3b82f6" },
        mist: { 100: "#eef2f9", 200: "#dbe3f0", 300: "#b6c2d9", 400: "#8b99b5", 500: "#64748b", 600: "#475569" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "'SF Mono'", "monospace"],
        display: ["Orbitron", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(245,158,11,0.45)",
        "glow-ion": "0 0 24px -6px rgba(34,211,238,0.4)",
        panel: "0 8px 32px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "pulse-dot": { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: "0.4", transform: "scale(0.8)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        drift: { "0%,100%": { transform: "translate(0,0)" }, "50%": { transform: "translate(20px,-16px)" } },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "spin-slow": "spin-slow 14s linear infinite",
        drift: "drift 16s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;