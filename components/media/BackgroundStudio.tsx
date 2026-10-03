/* =====================================================================
 * Background Studio — remove.bg-style full editor.
 * Upload once → AI removes background → change it to anything:
 * solid colors, gradients, blurred original, custom photo, preset scenes.
 * Plus drop shadow + foreground tweaks. Live preview. HD download.
 * 100% client-side (server API tried first for speed, on-device fallback).
 * ===================================================================== */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { loadBgEngine, removeBackgroundSmart, type ProgressCb, type RemoveFn } from "@/lib/bg-engine";
import { formatBytes } from "@/lib/utils";
import { saveBlob } from "@/lib/db";

type BgKind = "transparent" | "color" | "gradient" | "blur" | "image" | "preset";

const COLOR_SWATCHES = [
  "#ffffff", "#f5f5f4", "#e7e5e4", "#a8a29e", "#57534e", "#1c1917",
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#d946ef", "#ec4899",
];

const GRADIENTS: { name: string; from: string; to: string }[] = [
  { name: "Sunset", from: "#ff9a56", to: "#ff5e8a" },
  { name: "Ocean", from: "#2193b0", to: "#6dd5ed" },
  { name: "Violet", from: "#7c3aed", to: "#db2777" },
  { name: "Forest", from: "#134e5e", to: "#71b280" },
  { name: "Peach", from: "#ffecd2", to: "#fcb69f" },
  { name: "Midnight", from: "#232526", to: "#414345" },
  { name: "Candy", from: "#a18cd1", to: "#fbc2eb" },
  { name: "Fire", from: "#f83600", to: "#f9d423" },
];

const PRESETS: { name: string; css: string }[] = [
  { name: "Studio", css: "radial-gradient(circle at 50% 35%, #f8fafc 0%, #cbd5e1 55%, #94a3b8 100%)" },
  { name: "Beach", css: "linear-gradient(180deg, #7dd3fc 0%, #bae6fd 45%, #fde68a 75%, #fcd34d 100%)" },
  { name: "Office", css: "linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 60%, #94a3b8 100%)" },
  { name: "Neon", css: "radial-gradient(circle at 20% 20%, #d946ef 0%, transparent 50%), radial-gradient(circle at 80% 80%, #06b6d4 0%, transparent 50%), linear-gradient(135deg, #0f172a, #1e1b4b)" },
  { name: "Sunset", css: "linear-gradient(180deg, #312e81 0%, #be185d 55%, #fb923c 100%)" },
  { name: "Forest", css: "radial-gradient(circle at 50% 100%, #166534 0%, #052e16 70%)" },
];

export default function BackgroundStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"upload" | "removing" | "studio">("upload");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  // studio state
  const [bgKind, setBgKind] = useState<BgKind>("transparent");
  const [color, setColor] = useState("#ffffff");
  const [gradIdx, setGradIdx] = useState(0);
  const [gradAngle, setGradAngle] = useState(135);
  const [blurAmt, setBlurAmt] = useState(12);
  const [presetIdx, setPresetIdx] = useState(0);
  const [shadowOn, setShadowOn] = useState(true);
  const [shadowOpacity, setShadowOpacity] = useState(0.35);
  const [shadowBlur, setShadowBlur] = useState(24);
  const [shadowY, setShadowY] = useState(18);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [busy, setBusy] = useState(false);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement | null>(null);      // cutout RGBA
  const origRef = useRef<HTMLCanvasElement | null>(null);    // original (for blur bg)
  const customBgRef = useRef<HTMLCanvasElement | null>(null);// uploaded bg
  const silhouetteRef = useRef<HTMLCanvasElement | null>(null);
  const dimsRef = useRef({ w: 0, h: 0 });
  const removeFn = useRef<RemoveFn | null>(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null); setStage("upload"); setProgress(0); setStatus("");
    fgRef.current = null; origRef.current = null; customBgRef.current = null;
  };

  /* ---------------- removal ---------------- */

  const onFile = useCallback(async (f: File) => {
    if (!f.type.startsWith("image/")) { toast({ title: "Please choose an image file", variant: "error" }); return; }
    if (f.size > 12 * 1024 * 1024) { toast({ title: "Image too large — please use one under 12 MB.", variant: "error" }); return; }
    setFile(f);
    setStage("removing");
    setProgress(5);
    setStatus("Removing background…");
    try {
      const onProgress: ProgressCb = (_k, c, t) => { if (t > 0) setProgress(Math.min(90, Math.round((c / t) * 90))); };
      const ensure = async () => {
        if (!removeFn.current) removeFn.current = await loadBgEngine(onProgress);
        return removeFn.current;
      };
      const blob = await removeBackgroundSmart(f, onProgress, ensure);
      setProgress(92); setStatus("Preparing studio…");

      const bitmap = await createImageBitmap(blob);
      const fg = document.createElement("canvas");
      fg.width = bitmap.width; fg.height = bitmap.height;
      fg.getContext("2d")!.drawImage(bitmap, 0, 0);
      bitmap.close();
      fgRef.current = fg;
      dimsRef.current = { w: fg.width, h: fg.height };

      // original for blur-bg
      const ob = await createImageBitmap(f);
      const orig = document.createElement("canvas");
      orig.width = fg.width; orig.height = fg.height;
      orig.getContext("2d")!.drawImage(ob, 0, 0, fg.width, fg.height);
      ob.close();
      origRef.current = orig;

      // black silhouette for drop shadow
      const sil = document.createElement("canvas");
      sil.width = fg.width; sil.height = fg.height;
      const sctx = sil.getContext("2d")!;
      sctx.drawImage(fg, 0, 0);
      sctx.globalCompositeOperation = "source-in";
      sctx.fillStyle = "#000";
      sctx.fillRect(0, 0, sil.width, sil.height);
      silhouetteRef.current = sil;

      setProgress(100);
      setStage("studio");
      toast({ title: "Background removed — welcome to the studio!", variant: "success" });
    } catch {
      setStage("upload");
      toast({ title: "Could not remove background. Check connection and retry.", variant: "error" });
    } finally {
      setProgress(0); setStatus("");
    }
  }, [toast]);

  /* ---------------- compositing ---------------- */

  const drawPreview = useCallback(() => {
    const cv = previewRef.current;
    const fg = fgRef.current;
    if (!cv || !fg) return;
    const { w, h } = dimsRef.current;
    // preview at max ~900px wide for speed; download renders full-res
    const scale = Math.min(1, 900 / Math.max(w, h));
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, pw, ph);

    const drawCover = (src: HTMLCanvasElement) => {
      const s = Math.max(pw / src.width, ph / src.height);
      const dw = src.width * s, dh = src.height * s;
      ctx.drawImage(src, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
    };

    if (bgKind === "transparent") {
      // checkerboard
      const s = 16;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, pw, ph);
      ctx.fillStyle = "#d4d4d8";
      for (let y = 0; y < ph; y += s) for (let x = 0; x < pw; x += s)
        if (((x / s) + (y / s)) % 2 === 0) ctx.fillRect(x, y, s, s);
    } else if (bgKind === "color") {
      ctx.fillStyle = color; ctx.fillRect(0, 0, pw, ph);
    } else if (bgKind === "gradient") {
      const g = GRADIENTS[gradIdx];
      const rad = (gradAngle * Math.PI) / 180;
      const dx = Math.cos(rad), dy = Math.sin(rad);
      const grad = ctx.createLinearGradient(
        pw / 2 - dx * pw / 2, ph / 2 - dy * ph / 2,
        pw / 2 + dx * pw / 2, ph / 2 + dy * ph / 2
      );
      grad.addColorStop(0, g.from); grad.addColorStop(1, g.to);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, pw, ph);
    } else if (bgKind === "blur") {
      const orig = origRef.current;
      if (orig) {
        ctx.save();
        ctx.filter = `blur(${Math.max(0, blurAmt * scale)}px)`;
        // expand slightly so blur edges don't show transparency
        const pad = blurAmt * scale * 2 + 4;
        const s = Math.max((pw + pad * 2) / orig.width, (ph + pad * 2) / orig.height);
        const dw = orig.width * s, dh = orig.height * s;
        ctx.drawImage(orig, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, 0, pw, ph);
      }
    } else if (bgKind === "image") {
      const cb = customBgRef.current;
      if (cb) drawCover(cb);
      else { ctx.fillStyle = "#18181b"; ctx.fillRect(0, 0, pw, ph); }
    } else if (bgKind === "preset") {
      // render the CSS preset into an offscreen canvas via gradient approximation
      const tmp = document.createElement("canvas");
      tmp.width = pw; tmp.height = ph;
      // draw CSS gradient by painting it on a div-free path: use a temp element trick
      // simplest reliable: fill with layered canvas gradients approximating common presets
      paintPreset(tmp, presetIdx);
      ctx.drawImage(tmp, 0, 0);
    }

    // drop shadow (behind subject)
    if (shadowOn && silhouetteRef.current) {
      ctx.save();
      ctx.globalAlpha = shadowOpacity;
      ctx.filter = `blur(${Math.max(0, shadowBlur * scale)}px)`;
      ctx.drawImage(silhouetteRef.current, 0, shadowY * scale, pw, ph);
      ctx.restore();
    }

    // foreground with adjustments
    ctx.save();
    if (brightness !== 100 || contrast !== 100)
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(fg, 0, 0, pw, ph);
    ctx.restore();
  }, [bgKind, color, gradIdx, gradAngle, blurAmt, presetIdx, shadowOn, shadowOpacity, shadowBlur, shadowY, brightness, contrast]);

  useEffect(() => { if (stage === "studio") drawPreview(); }, [stage, drawPreview]);

  /* ---------------- custom bg upload ---------------- */

  const onCustomBg = async (f: File) => {
    try {
      const b = await createImageBitmap(f);
      const c = document.createElement("canvas");
      c.width = b.width; c.height = b.height;
      c.getContext("2d")!.drawImage(b, 0, 0);
      b.close();
      customBgRef.current = c;
      setBgKind("image");
      toast({ title: "Custom background set", variant: "success" });
    } catch {
      toast({ title: "Could not read that image.", variant: "error" });
    }
  };

  /* ---------------- HD download ---------------- */

  const download = async (hd: boolean) => {
    const fg = fgRef.current;
    if (!fg || busy) return;
    setBusy(true);
    try {
      const { w, h } = dimsRef.current;
      const scale = hd ? 1 : Math.min(1, 900 / Math.max(w, h));
      const out = document.createElement("canvas");
      out.width = Math.round(w * scale); out.height = Math.round(h * scale);
      const ctx = out.getContext("2d")!;
      const pw = out.width, ph = out.height;

      if (bgKind === "color") { ctx.fillStyle = color; ctx.fillRect(0, 0, pw, ph); }
      else if (bgKind === "gradient") {
        const g = GRADIENTS[gradIdx];
        const rad = (gradAngle * Math.PI) / 180;
        const dx = Math.cos(rad), dy = Math.sin(rad);
        const gr = ctx.createLinearGradient(pw/2 - dx*pw/2, ph/2 - dy*ph/2, pw/2 + dx*pw/2, ph/2 + dy*ph/2);
        gr.addColorStop(0, g.from); gr.addColorStop(1, g.to);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, pw, ph);
      } else if (bgKind === "blur" && origRef.current) {
        ctx.save();
        ctx.filter = `blur(${blurAmt * scale}px)`;
        const pad = blurAmt * scale * 2 + 4;
        const s = Math.max((pw + pad * 2) / origRef.current.width, (ph + pad * 2) / origRef.current.height);
        const dw = origRef.current.width * s, dh = origRef.current.height * s;
        ctx.drawImage(origRef.current, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, 0, pw, ph);
      } else if (bgKind === "image" && customBgRef.current) {
        const src = customBgRef.current;
        const s = Math.max(pw / src.width, ph / src.height);
        const dw = src.width * s, dh = src.height * s;
        ctx.drawImage(src, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
      } else if (bgKind === "preset") {
        paintPreset(out, presetIdx);
      }
      // (transparent → leave empty)

      if (shadowOn && silhouetteRef.current) {
        ctx.save();
        ctx.globalAlpha = shadowOpacity;
        ctx.filter = `blur(${shadowBlur * scale}px)`;
        ctx.drawImage(silhouetteRef.current, 0, shadowY * scale, pw, ph);
        ctx.restore();
      }
      ctx.save();
      if (brightness !== 100 || contrast !== 100)
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(fg, 0, 0, pw, ph);
      ctx.restore();

      const blob = await new Promise<Blob | null>(res => out.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode");
      // Persist so the output survives refresh — best-effort, never blocks UX.
      try {
        void saveBlob("image", blob, hd ? "background-studio-hd.png" : "background-studio.png", {
          tool: "bg-studio",
          background: bgKind,
        });
      } catch {
        /* library save is non-critical */
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = hd ? "background-studio-hd.png" : "background-studio.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: `Downloaded ${hd ? "HD " : ""}PNG (${formatBytes(blob.size)})`, variant: "success" });
    } catch {
      toast({ title: "Export failed.", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- render ---------------- */

  if (stage === "upload") {
    return (
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center transition hover:border-fuchsia-500/50 hover:bg-white/[0.05]">
        <span className="text-4xl">🎨</span>
        <span className="text-sm font-medium text-zinc-300">Tap to upload a photo</span>
        <span className="text-xs text-zinc-500">AI removes the background, then the studio opens — colors, gradients, blur, shadows & more</span>
        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </label>
    );
  }

  if (stage === "removing") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/[0.03] px-6 py-16 ring-1 ring-white/10">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
        <p className="text-sm text-zinc-300">{status || "Removing background…"}</p>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  const tabs: { id: BgKind; label: string }[] = [
    { id: "transparent", label: "◻️ None" },
    { id: "color", label: "🎨 Color" },
    { id: "gradient", label: "🌈 Gradient" },
    { id: "blur", label: "💧 Blur" },
    { id: "image", label: "🖼️ Photo" },
    { id: "preset", label: "🏞️ Scenes" },
  ];

  return (
    <div className="space-y-4">
      {/* live preview */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
        <canvas ref={previewRef} className="block w-full" />
      </div>

      {/* bg type tabs */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setBgKind(t.id)}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              bgKind === t.id ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/25" : "bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* per-kind controls */}
      <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
        {bgKind === "color" && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map(c => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  className={`h-8 w-8 rounded-full ring-2 transition ${color === c ? "ring-fuchsia-400 scale-110" : "ring-white/20"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              Custom
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded bg-transparent" />
              <span className="font-mono text-zinc-300">{color}</span>
            </label>
          </div>
        )}
        {bgKind === "gradient" && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-4 gap-1.5">
              {GRADIENTS.map((g, i) => (
                <button key={g.name} onClick={() => setGradIdx(i)}
                  className={`h-12 rounded-lg ring-2 transition ${gradIdx === i ? "ring-fuchsia-400 scale-[1.03]" : "ring-white/10"}`}
                  style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }} title={g.name} />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              Angle
              <input type="range" min={0} max={360} value={gradAngle} onChange={e => setGradAngle(+e.target.value)} className="flex-1 accent-fuchsia-500" />
              <span className="w-10 text-zinc-300">{gradAngle}°</span>
            </label>
          </div>
        )}
        {bgKind === "blur" && (
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Blur intensity
            <input type="range" min={0} max={40} value={blurAmt} onChange={e => setBlurAmt(+e.target.value)} className="flex-1 accent-fuchsia-500" />
            <span className="w-8 text-zinc-300">{blurAmt}</span>
          </label>
        )}
        {bgKind === "image" && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-xs font-semibold text-zinc-300 hover:border-fuchsia-500/50">
            📤 Upload background photo
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onCustomBg(f); }} />
          </label>
        )}
        {bgKind === "preset" && (
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((p, i) => (
              <button key={p.name} onClick={() => setPresetIdx(i)}
                className={`h-14 rounded-lg text-[11px] font-bold text-white ring-2 transition ${presetIdx === i ? "ring-fuchsia-400 scale-[1.03]" : "ring-white/10"}`}
                style={{ background: p.css }}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        {bgKind === "transparent" && (
          <p className="text-xs text-zinc-500">Transparent background — downloads as PNG with alpha.</p>
        )}
      </div>

      {/* shadow */}
      <div className="space-y-2.5 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
        <button onClick={() => setShadowOn(v => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-zinc-200">
          <span>🌑 Drop shadow</span>
          <span className={`relative h-6 w-11 rounded-full transition ${shadowOn ? "bg-fuchsia-600" : "bg-white/10"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${shadowOn ? "left-[22px]" : "left-0.5"}`} />
          </span>
        </button>
        {shadowOn && (
          <>
            <Slider label="Opacity" value={shadowOpacity} min={0} max={1} step={0.05} onChange={setShadowOpacity} fmt={v => `${Math.round(v * 100)}%`} />
            <Slider label="Softness" value={shadowBlur} min={0} max={60} onChange={setShadowBlur} fmt={v => `${v}px`} />
            <Slider label="Distance" value={shadowY} min={0} max={80} onChange={setShadowY} fmt={v => `${v}px`} />
          </>
        )}
      </div>

      {/* foreground */}
      <div className="space-y-2.5 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
        <p className="text-sm font-semibold text-zinc-200">✨ Subject adjustments</p>
        <Slider label="Brightness" value={brightness} min={50} max={150} onChange={setBrightness} fmt={v => `${v}%`} />
        <Slider label="Contrast" value={contrast} min={50} max={150} onChange={setContrast} fmt={v => `${v}%`} />
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => download(true)} disabled={busy}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:opacity-50">
          ⬇️ Download HD
        </button>
        <button onClick={() => download(false)} disabled={busy}
          className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50">
          Quick PNG
        </button>
        <button onClick={reset} className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 ring-1 ring-white/10 hover:bg-white/10">
          New photo
        </button>
      </div>
      <p className="text-center text-[11px] text-zinc-600">HD renders at your photo's full original resolution.</p>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)} className="flex-1 accent-fuchsia-500" />
      <span className="w-12 shrink-0 text-right text-zinc-300">{fmt(value)}</span>
    </label>
  );
}

/** Paint a preset scene into a canvas (canvas-gradient approximation of the CSS looks). */
function paintPreset(cv: HTMLCanvasElement, idx: number) {
  const ctx = cv.getContext("2d")!;
  const w = cv.width, h = cv.height;
  const lin = (stops: [number, string][]) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
  switch (idx) {
    case 0: { // Studio
      const g = ctx.createRadialGradient(w/2, h*0.35, 10, w/2, h*0.35, Math.max(w, h)*0.8);
      g.addColorStop(0, "#f8fafc"); g.addColorStop(0.55, "#cbd5e1"); g.addColorStop(1, "#94a3b8");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); break;
    }
    case 1: lin([[0, "#7dd3fc"], [0.45, "#bae6fd"], [0.75, "#fde68a"], [1, "#fcd34d"]]); break; // Beach
    case 2: lin([[0, "#e2e8f0"], [0.6, "#cbd5e1"], [1, "#94a3b8"]]); break; // Office
    case 3: { // Neon
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, w, h);
      const a = ctx.createRadialGradient(w*0.2, h*0.2, 10, w*0.2, h*0.2, w*0.5);
      a.addColorStop(0, "rgba(217,70,239,0.8)"); a.addColorStop(1, "rgba(217,70,239,0)");
      ctx.fillStyle = a; ctx.fillRect(0, 0, w, h);
      const b = ctx.createRadialGradient(w*0.8, h*0.8, 10, w*0.8, h*0.8, w*0.5);
      b.addColorStop(0, "rgba(6,182,212,0.8)"); b.addColorStop(1, "rgba(6,182,212,0)");
      ctx.fillStyle = b; ctx.fillRect(0, 0, w, h); break;
    }
    case 4: lin([[0, "#312e81"], [0.55, "#be185d"], [1, "#fb923c"]]); break; // Sunset
    default: { // Forest
      const g = ctx.createRadialGradient(w/2, h, 10, w/2, h, h);
      g.addColorStop(0, "#166534"); g.addColorStop(1, "#052e16");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
}
