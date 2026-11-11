"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Mic, MicOff, ImagePlus, X, Volume2, VolumeX, Bot, Sparkles, Wrench, ChevronDown, Loader2, Radio } from "lucide-react";
import { api, fileToB64 } from "@/lib/api";
import { Markdown, Badge } from "./ui";

interface ToolCall { tool: string; arguments?: any; params?: any; result_preview?: string }
interface Msg {
  id: string;
  role: "user" | "agent";
  text: string;
  image?: string;
  agent?: { callsign: string; name: string; badge: string; role: string };
  tools?: ToolCall[];
  artifacts?: { annotated_flame_b64?: string; thermal_tomography_b64?: string };
  mode?: string;
  steps?: number;
  inputMode?: string;
}

const AGENT_COLORS: Record<string, string> = {
  "FLIGHT-SAFETY": "#ef4444", "AERO-PHYSICS": "#e879f9", "OPTICAL-TRACKER": "#60a5fa",
  "NASA-ARCHIVIST": "#4ade80", "TELEMETRY-LEAD": "#fbbf24",
};

const QUICK = [
  "Predict PMMA flammability at 17% O2 and 1 cm/s flow",
  "Search NASA literature on microgravity flame extinction",
  "What is the current cabin telemetry and safety status?",
  "Rank experiments matching the Lunar habitat atmosphere",
  "Design a hypothesis for the Gateway low-flow parameter void",
];

export default function AICommand() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [forced, setForced] = useState<string>("");
  const [image, setImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [aiMode, setAiMode] = useState<string>("…");
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.agents().then((d) => setAgents(d.agents)).catch(() => {});
    api.aiStatus().then((d) => setAiMode(d.mode)).catch(() => setAiMode("OFFLINE"));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const speakText = (t: string) => {
    if (!speak || typeof window === "undefined" || !window.speechSynthesis) return;
    const clean = t.replace(/[#*`>\[\]()]/g, "").slice(0, 500);
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05; u.pitch = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const send = async (text: string, img?: string | null) => {
    const q = text.trim();
    if ((!q && !img) || busy) return;
    const uid = `u${Date.now()}`;
    setMessages((m) => [...m, { id: uid, role: "user", text: q || "[flame image attached]", image: img || undefined }]);
    setInput(""); setImage(null); setBusy(true);
    if (taRef.current) taRef.current.style.height = "auto";
    try {
      const d = await api.chat({ message: q, image_b64: img || undefined, agent_callsign: forced || undefined });
      const aid = `a${Date.now()}`;
      setMessages((m) => [...m, {
        id: aid, role: "agent", text: d.response_markdown, agent: d.active_agent,
        tools: d.tool_calls_executed, artifacts: d.visual_artifacts, mode: d.intelligence_mode,
        steps: d.reasoning_steps, inputMode: d.input_mode,
      }]);
      setAiMode(d.intelligence_mode || aiMode);
      speakText(d.response_markdown);
    } catch (e: any) {
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: "agent", text: `⚠️ Backend unreachable: ${e.message}. Start the FastAPI server on port 8000.` }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Browser speech recognition unavailable. Use Chrome/Edge, or type your query."); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (ev: any) => {
      let t = "";
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      setInput(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await fileToB64(f);
    setImage(b64);
    e.target.value = "";
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input, image); }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-nova-500/30 to-ion-500/20 border border-nova-500/40">
            <Bot className="h-5 w-5 text-nova-400" />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-wide text-mist-100">AI COMMAND CENTER</div>
            <div className="text-[10px] text-mist-500">5-Agent Scientific Super-Intelligence · Tool Calling · Vision · Voice</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge color={aiMode.includes("LLM") ? "#4ade80" : "#fbbf24"} pulse>
            {aiMode.includes("LLM") ? "LLM ONLINE" : aiMode}
          </Badge>
          <select value={forced} onChange={(e) => setForced(e.target.value)}
            className="rounded-lg border border-line bg-void-900 px-2.5 py-1.5 text-xs text-mist-200 outline-none focus:border-ion-500/60">
            <option value="">Auto-Route Agent</option>
            {agents.map((a) => <option key={a.callsign} value={a.callsign}>{a.callsign}</option>)}
          </select>
          <button onClick={() => setSpeak((s) => !s)} title="Toggle voice output"
            className={`btn !px-2.5 ${speak ? "!border-pulse-500/50 !text-pulse-400" : ""}`}>
            {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center animate-fade-up">
            <div className="relative">
              <div className="absolute inset-0 animate-drift rounded-full bg-ember-500/20 blur-2xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-ember-500/40 bg-gradient-to-br from-ember-600/20 to-nova-500/10">
                <Sparkles className="h-9 w-9 text-ember-400" />
              </div>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-mist-100">ShunnoShikha Super-Intelligence</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">
                Ask about microgravity fire safety. The agent autonomously calls the digital twin, SHAP model,
                live NASA RAG, flame vision, and telemetry tools — then reasons with citations.
              </p>
            </div>
            <div className="flex max-w-2xl flex-wrap justify-center gap-2">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)} className="chip hover:!border-ember-500/50 hover:!text-ember-300">
                  <Radio className="h-3 w-3 text-ember-500" /> {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 animate-fade-up ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold"
              style={{
                borderColor: m.role === "user" ? "#2c3d63" : `${AGENT_COLORS[m.agent?.callsign || ""] || "#e879f9"}66`,
                background: m.role === "user" ? "#131c33" : `${AGENT_COLORS[m.agent?.callsign || ""] || "#e879f9"}18`,
                color: m.role === "user" ? "#b6c2d9" : AGENT_COLORS[m.agent?.callsign || ""] || "#e879f9",
              }}>
              {m.role === "user" ? "YOU" : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[80%] ${m.role === "user" ? "items-end" : ""}`}>
              {m.role === "agent" && m.agent && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] font-bold" style={{ color: AGENT_COLORS[m.agent.callsign] }}>{m.agent.callsign}</span>
                  <span className="text-[10px] text-mist-500">{m.agent.name}</span>
                  {m.steps != null && <span className="text-[10px] text-mist-600">· {m.steps} reasoning steps</span>}
                </div>
              )}
              <div className={`rounded-xl border px-4 py-3 ${m.role === "user" ? "border-line-bright bg-void-700/70" : "border-line bg-void-850/90"}`}>
                {m.image && <img src={`data:image/png;base64,${m.image}`} alt="attached" className="mb-2 max-h-44 rounded-lg border border-line" />}
                {m.role === "user" ? <p className="text-sm text-mist-100">{m.text}</p> : <Markdown>{m.text}</Markdown>}

                {m.artifacts?.annotated_flame_b64 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <img src={m.artifacts.annotated_flame_b64} alt="annotated flame" className="rounded-lg border border-line" />
                    <img src={m.artifacts.thermal_tomography_b64} alt="thermal tomography" className="rounded-lg border border-line" />
                  </div>
                )}

                {m.tools && m.tools.length > 0 && (
                  <div className="mt-3 border-t border-line pt-2">
                    <button onClick={() => setOpenTools((o) => ({ ...o, [m.id]: !o[m.id] }))}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-ion-400 hover:text-ion-300">
                      <Wrench className="h-3 w-3" /> {m.tools.length} tool call{m.tools.length > 1 ? "s" : ""} executed
                      <ChevronDown className={`h-3 w-3 transition-transform ${openTools[m.id] ? "rotate-180" : ""}`} />
                    </button>
                    {openTools[m.id] && (
                      <div className="mt-2 space-y-1.5">
                        {m.tools.map((t, i) => (
                          <div key={i} className="rounded-md border border-line bg-void-900 px-2.5 py-1.5 font-mono text-[10px]">
                            <span className="text-ember-400">{t.tool}</span>
                            <span className="text-mist-500">({JSON.stringify(t.arguments || t.params || {})})</span>
                            {t.result_preview && <div className="mt-1 truncate text-mist-600" title={t.result_preview}>→ {t.result_preview}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-3 animate-fade-up">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-nova-500/40 bg-nova-500/10">
              <Loader2 className="h-4 w-4 animate-spin text-nova-400" />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-void-850 px-4 py-3">
              <span className="text-sm text-mist-400">Agent reasoning</span>
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-void-900/70 px-5 py-3 backdrop-blur">
        {image && (
          <div className="mb-2 flex items-center gap-2">
            <img src={`data:image/png;base64,${image}`} alt="preview" className="h-14 rounded-lg border border-ion-500/40" />
            <button onClick={() => setImage(null)} className="btn !px-2 !py-1 text-xs"><X className="h-3 w-3" /> Remove</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} title="Attach flame image (vision)" className="btn !px-3"><ImagePlus className="h-4 w-4 text-ion-400" /></button>
          <button onClick={toggleMic} title="Voice input" className={`btn !px-3 ${listening ? "!border-flame-500/60 !text-flame-400 !shadow-glow" : ""}`}>
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-ember-400" />}
          </button>
          <textarea ref={taRef} value={input} rows={1}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
            onKeyDown={onKey}
            placeholder={listening ? "Listening… speak now" : "Ask the scientific intelligence… (Enter to send, Shift+Enter for newline)"}
            className="input max-h-36 flex-1 resize-none py-2.5" />
          <button onClick={() => send(input, image)} disabled={busy || (!input.trim() && !image)} className="btn btn-primary !px-4">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-mist-600">
          <span>{listening ? "🔴 Recording — click mic to stop" : "Voice via browser speech recognition · responses can be spoken aloud"}</span>
          <span>Powered by local omni-model · live NASA RAG · no data leaves your machine</span>
        </div>
      </div>
    </div>
  );
}