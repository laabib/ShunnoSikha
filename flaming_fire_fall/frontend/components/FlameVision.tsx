"use client";

import React, { useRef, useState } from "react";
import { Eye, Upload, ScanLine, Sparkles, Ruler, MoveRight, Circle } from "lucide-react";
import { api, uploadFile, fileToB64 } from "@/lib/api";
import { Panel, Stat, Badge, Loading, Markdown } from "./ui";

export default function FlameVision() {
  const [frame, setFrame] = useState(1);
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [desc, setDesc] = useState("");
  const [descLoading, setDescLoading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyzeFrame = async (n: number) => {
    setFrame(n); setUploaded(null); setDesc(""); setLoading(true);
    try { setRes(await api.visionFrame(n)); } catch {} finally { setLoading(false); }
  };

  React.useEffect(() => { analyzeFrame(1); }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true); setDesc("");
    try {
      const r = await uploadFile<any>("/api/vision/analyze-upload", f, f.name);
      setRes(r);
      setUploaded(await fileToB64(f));
    } catch {} finally { setLoading(false); e.target.value = ""; }
  };

  const describe = async () => {
    const b64 = uploaded || (res?.annotated_image_b64 || "").split(",")[1];
    if (!b64) return;
    setDescLoading(true);
    try { const d = await api.visionDescribe({ image_b64: b64 }); setDesc(d.description); }
    catch { setDesc("Vision LLM unavailable."); } finally { setDescLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Panel title="NASA BASS-II Frame Sequence" icon={<ScanLine className="h-4 w-4" />} className="flex-1 !p-0">
          <div className="flex items-center gap-2 p-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => analyzeFrame(n)}
                className={`flex h-11 flex-1 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-all ${frame === n && !uploaded ? "border-ember-500/60 bg-ember-500/15 text-ember-300 shadow-glow" : "border-line bg-void-900 text-mist-400 hover:border-line-bright"}`}>
                F{n}
              </button>
            ))}
            <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="btn btn-ion !py-2.5 text-xs"><Upload className="h-4 w-4" /> Upload Frame</button>
          </div>
        </Panel>
      </div>

      {loading ? <Loading label="Segmenting flame envelope" /> : res && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Panel title="Annotated Segmentation" icon={<Eye className="h-4 w-4" />}>
                <img src={res.annotated_image_b64} alt="annotated flame" className="w-full rounded-lg border border-line" />
              </Panel>
              <Panel title="Pseudo-Color Thermal Tomography" icon={<Sparkles className="h-4 w-4" />}>
                <img src={res.thermal_tomography_b64} alt="thermal map" className="w-full rounded-lg border border-line" />
              </Panel>
            </div>
            <Panel title="Optical Intelligence Interpretation" icon={<Sparkles className="h-4 w-4" />}
              right={<button onClick={describe} disabled={descLoading} className="btn btn-ion !px-2.5 !py-1 text-[11px]">{descLoading ? "Analyzing…" : "LLM Vision"}</button>}>
              {desc ? <Markdown>{desc}</Markdown> : (
                <p className="text-sm text-mist-500">
                  The segmentation fits a minimum enclosing ellipse to the luminous envelope. In microgravity the flame adopts a
                  symmetric oval-ball geometry (no buoyant teardrop stretching). Click <span className="text-ion-400">LLM Vision</span> for
                  a multimodal scientific interpretation of the thermal structure.
                </p>
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Flame Kinematics" icon={<Ruler className="h-4 w-4" />}>
              <div className="mb-3"><Badge color={res.flame_detected ? "#4ade80" : "#ef4444"} pulse>{res.flame_detected ? "FLAME DETECTED" : "NO FLAME"}</Badge></div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Flame Area" value={res.flame_area_mm2} unit="mm²" accent="#f59e0b" />
                <Stat label="Aspect Ratio" value={res.aspect_ratio} accent="#22d3ee" sub="major / minor" />
                <Stat label="Spread Rate V_f" value={res.flame_spread_rate_mms} unit="mm/s" accent="#4ade80" />
                <Stat label="Standoff" value={res.standoff_distance_mm} unit="mm" accent="#e879f9" />
                <Stat label="Major Axis" value={res.major_axis_mm} unit="mm" accent="#60a5fa" />
                <Stat label="Minor Axis" value={res.minor_axis_mm} unit="mm" accent="#60a5fa" />
              </div>
              <div className="metric-num mt-3 rounded-lg border border-line bg-void-900 px-3 py-2 text-[11px] text-mist-500">
                centroid → ({res.centroid?.x}, {res.centroid?.y}) px · {res.flame_area_px?.toFixed(0)} px²
              </div>
            </Panel>
            <div className="panel p-4 text-[11px] leading-relaxed text-mist-500">
              <span className="font-semibold text-ember-400">Physics note · </span>
              Without buoyancy, soot resides longer in the reaction zone, raising radiative loss. The blue CH* core marks
              chemiluminescence; the yellow-orange mantle is radiant soot emission. Scale: 0.12 mm/px.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}