/* =====================================================================
 * Watermark Remover — Gemini Reverse Alpha Blending (real method) +
 * manual brush inpainting fallback. Images AND video. Client-side.
 *
 * CORE METHOD: ported from the open-source "gemini-watermark-remover"
 * by GargantuaX (https://github.com/GargantuaX/gemini-watermark-remover),
 * MIT License. Original method © 2024 AllenK (Kwyshell).
 *
 * Gemini blends its watermark with standard alpha compositing:
 *     watermarked = α·logo + (1−α)·original   (logo = white 255)
 * so the original pixels are recovered EXACTLY with:
 *     original = (watermarked − α·255) / (1−α)
 * using their calibrated per-pixel alpha maps (see lib/gemini-watermark.ts).
 * This is mathematically exact — NOT AI inpainting, zero hallucination.
 * ===================================================================== */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { autoRemoveGeminiWatermark, detectWatermarkConfig, calculateWatermarkPosition, getAlphaMap, removeWatermarkReverseAlpha } from "@/lib/gemini-watermark";

/* ---------------- manual inpainting fallback (non-Gemini marks) -------- */

const MAX_DIM = 2048;

export interface InpaintPlan {
  w: number;
  h: number;
  dist: Float32Array; // distance to nearest unmasked pixel
  nx: Int16Array;     // nearest unmasked x
  ny: Int16Array;     // nearest unmasked y
  feather: Float32Array;
}

export function computeInpaintPlan(mask: Uint8Array, w: number, h: number, feather = 3): InpaintPlan {
  const dist = new Float32Array(w * h).fill(Infinity);
  const nx = new Int16Array(w * h);
  const ny = new Int16Array(w * h);
  const queue: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) { dist[i] = 0; nx[i] = x; ny[i] = y; queue.push(i); }
    }
  }
  const dirs = [1, 0, -1, 0, 1];
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    for (let d = 0; d < 4; d++) {
      const ax = x + dirs[d], ay = y + dirs[d + 1];
      if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
      const j = ay * w + ax;
      if (dist[j] > dist[i] + 1) {
        dist[j] = dist[i] + 1; nx[j] = nx[i]; ny[j] = ny[i]; queue.push(j);
      }
    }
  }
  const featherArr = new Float32Array(w * h);
  if (feather > 0) {
    for (let i = 0; i < w * h; i++) {
      if (mask[i]) {
        const t = Math.min(1, dist[i] / feather);
        featherArr[i] = t * t * (3 - 2 * t);
      }
    }
  }
  return { w, h, dist, nx, ny, feather: featherArr };
}

export function runInpaintFill(src: ImageData, plan: InpaintPlan, mask: Uint8Array): ImageData {
  const { w, h, nx, ny } = plan;
  const out = new ImageData(w, h);
  const s = src.data, o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, oi = i * 4;
      if (!mask[i]) {
        o[oi] = s[oi]; o[oi + 1] = s[oi + 1]; o[oi + 2] = s[oi + 2]; o[oi + 3] = s[oi + 3];
        continue;
      }
      // sample a small neighbourhood around the nearest clean pixel for texture
      let r = 0, g = 0, b = 0, n = 0;
      const cx = nx[i], cy = ny[i];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const sx = cx + dx, sy = cy + dy;
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
          const si = sy * w + sx;
          if (mask[si]) continue;
          const soi = si * 4;
          r += s[soi]; g += s[soi + 1]; b += s[soi + 2]; n++;
        }
      }
      if (n === 0) { o[oi] = s[oi]; o[oi + 1] = s[oi + 1]; o[oi + 2] = s[oi + 2]; }
      else { o[oi] = r / n; o[oi + 1] = g / n; o[oi + 2] = b / n; }
      o[oi + 3] = 255;
    }
  }
  return out;
}

export function featherBlend(original: ImageData, filled: ImageData, plan: InpaintPlan, mask: Uint8Array): ImageData {
  const { w, h, feather } = plan;
  const out = new ImageData(w, h);
  const a = original.data, b = filled.data, o = out.data;
  for (let i = 0; i < w * h; i++) {
    const oi = i * 4;
    if (!mask[i]) {
      o[oi] = a[oi]; o[oi + 1] = a[oi + 1]; o[oi + 2] = a[oi + 2]; o[oi + 3] = 255;
    } else {
      const t = feather[i];
      o[oi] = a[oi] + (b[oi] - a[oi]) * t;
      o[oi + 1] = a[oi + 1] + (b[oi + 1] - a[oi + 1]) * t;
      o[oi + 2] = a[oi + 2] + (b[oi + 2] - a[oi + 2]) * t;
      o[oi + 3] = 255;
    }
  }
  return out;
}

export function inpaintImage(src: ImageData, mask: Uint8Array): ImageData {
  const plan = computeInpaintPlan(mask, src.width, src.height);
  return featherBlend(src, runInpaintFill(src, plan, mask), plan, mask);
}

/* =====================================================================
 * COMPONENT
 * ===================================================================== */

type Mode = "image" | "video";
type Method = "auto" | "manual";

async function loadImage(file: File): Promise<{ bitmap: ImageBitmap; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  return { bitmap, w: Math.round(bitmap.width * scale), h: Math.round(bitmap.height * scale) };
}

export default function WatermarkRemover() {
  const [tab, setTab] = useState<Mode>("image");
  const [method, setMethod] = useState<Method>("auto");
  const [file, setFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBeforeUrl, setVideoBeforeUrl] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(28);
  const [paintMode, setPaintMode] = useState<"brush" | "eraser">("brush");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [hasMask, setHasMask] = useState(false);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [slider, setSlider] = useState(50);
  const [confidence, setConfidence] = useState<number | null>(null);

  const imgCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement>(null); // hidden, keeps original
  const videoRef = useRef<HTMLVideoElement>(null);
  const painting = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => () => {
    if (afterUrl) URL.revokeObjectURL(afterUrl);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (videoBeforeUrl) URL.revokeObjectURL(videoBeforeUrl);
    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
  }, []);

  const reset = () => {
    if (afterUrl) URL.revokeObjectURL(afterUrl);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (videoBeforeUrl) URL.revokeObjectURL(videoBeforeUrl);
    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    setFile(null); setAfterUrl(null); setVideoUrl(null); setVideoBeforeUrl(null);
    setBeforeUrl(null); setHasMask(false); setConfidence(null);
    setProgress(0); setStatus(""); setSlider(50);
  };

  /* ---------------- image setup ---------------- */

  const setupImage = useCallback(async (f: File) => {
    reset();
    setFile(f);
    try {
      const { bitmap, w, h } = await loadImage(f);
      setImgDims({ w, h });
      const c = imgCanvasRef.current, m = maskCanvasRef.current, b = beforeCanvasRef.current;
      if (c && m && b) {
        for (const cv of [c, m, b]) { cv.width = w; cv.height = h; }
        const ctx = c.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0, w, h);
        b.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
        m.getContext("2d")!.clearRect(0, 0, w, h);
        setBeforeUrl(c.toDataURL("image/png"));
      }
      bitmap.close();
    } catch {
      toast({ title: "Could not read that image.", variant: "error" });
    }
  }, [toast]);

  /* ---------------- AUTO: exact reverse-alpha removal ---------------- */

  const autoRemoveImage = useCallback(async () => {
    const c = imgCanvasRef.current;
    if (!c) return;
    setBusy(true); setStatus("Detecting watermark…"); setProgress(10);
    try {
      // let the UI paint before the heavy sync work
      await new Promise(r => setTimeout(r, 30));
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      setProgress(35); setStatus("Applying reverse alpha blending…");
      await new Promise(r => setTimeout(r, 30));
      const { rect, confidence: conf, size } = autoRemoveGeminiWatermark(imageData);
      ctx.putImageData(imageData, 0, 0);
      setConfidence(conf);
      setAfterUrl(c.toDataURL("image/png"));
      setSlider(50);
      setProgress(100); setStatus("");
      toast({
        title: conf > 0.6
          ? `Watermark removed — ${size}×${size} mark at bottom-right (${Math.round(conf * 100)}% match).`
          : "Processed. If a mark remains, try Manual brush mode.",
        variant: "success"
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Auto removal failed — try Manual brush mode.", variant: "error" });
    } finally {
      setBusy(false); setProgress(0);
    }
  }, [toast]);

  /* ---------------- MANUAL brush inpainting ---------------- */

  const getPos = (e: React.PointerEvent, canvas: HTMLCanvasElement) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };

  const paintAt = (pos: { x: number; y: number }) => {
    const m = maskCanvasRef.current;
    if (!m) return;
    const ctx = m.getContext("2d")!;
    ctx.globalCompositeOperation = paintMode === "brush" ? "source-over" : "destination-out";
    ctx.strokeStyle = "rgba(255,0,80,0.85)";
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,0,80,0.85)"; ctx.fill();
    }
    lastPos.current = pos;
    setHasMask(true);
  };

  const manualRemoveImage = useCallback(async () => {
    const c = imgCanvasRef.current, m = maskCanvasRef.current;
    if (!c || !m) return;
    setBusy(true); setStatus("Inpainting…"); setProgress(20);
    try {
      await new Promise(r => setTimeout(r, 30));
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      const src = ctx.getImageData(0, 0, c.width, c.height);
      const maskData = m.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
      const mask = new Uint8Array(c.width * c.height);
      for (let i = 0; i < mask.length; i++) mask[i] = maskData[i * 4 + 3] > 10 ? 1 : 0;
      setProgress(50);
      await new Promise(r => setTimeout(r, 30));
      const out = inpaintImage(src, mask);
      ctx.putImageData(out, 0, 0);
      setAfterUrl(c.toDataURL("image/png"));
      setConfidence(null);
      setSlider(50);
      setProgress(100); setStatus("");
      toast({ title: "Watermark area inpainted.", variant: "success" });
    } catch (e) {
      console.error(e);
      toast({ title: "Inpainting failed.", variant: "error" });
    } finally {
      setBusy(false); setProgress(0);
    }
  }, [toast]);

  const downloadImage = () => {
    if (!afterUrl) return;
    const a = document.createElement("a");
    a.href = afterUrl;
    a.download = "watermark-removed.png";
    a.click();
  };

  /* ---------------- VIDEO: per-frame reverse alpha ---------------- */

  const setupVideo = useCallback((f: File) => {
    reset();
    setFile(f);
    const url = URL.createObjectURL(f);
    setVideoBeforeUrl(url);
    const v = videoRef.current;
    if (v) { v.src = url; v.load(); }
  }, []);

  const autoRemoveVideo = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !file) return;
    setBusy(true); setStatus("Loading video…"); setProgress(5);
    try {
      await new Promise<void>((resolve, reject) => {
        if (v.readyState >= 1) resolve();
        else { v.onloadedmetadata = () => resolve(); v.onerror = () => reject(new Error("load")); }
      });
      const vw = v.videoWidth, vh = v.videoHeight;
      if (!vw || !vh) throw new Error("No video dimensions");

      const scale = Math.min(1, 1280 / Math.max(vw, vh));
      const w = Math.round(vw * scale), h = Math.round(vh * scale);

      const work = document.createElement("canvas");
      work.width = w; work.height = h;
      const wctx = work.getContext("2d", { willReadFrequently: true })!;

      // detect watermark rect from first frame (position is static across frames)
      setStatus("Detecting watermark…");
      v.currentTime = 0;
      await new Promise<void>(res => { v.onseeked = () => res(); });
      wctx.drawImage(v, 0, 0, w, h);
      const first = wctx.getImageData(0, 0, w, h);
      const { confidence: conf } = autoRemoveGeminiWatermark(first);
      setConfidence(conf);
      // reuse the detected config for every frame (fast path — no re-search)
      const cfg = detectWatermarkConfig(w, h);
      const r = calculateWatermarkPosition(w, h, cfg);
      const alphaMap = getAlphaMap(cfg.logoSize);

      const stream = work.captureStream(30);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: "video/webm" })); });

      const duration = v.duration || 5;
      const fps = 12; // process at 12fps for speed; motion is preserved by re-encode timing
      const totalFrames = Math.max(1, Math.round(duration * fps));
      rec.start(500);
      setStatus("Removing watermark frame by frame…");

      for (let i = 0; i < totalFrames; i++) {
        const t = (i / fps);
        v.currentTime = Math.min(t, Math.max(0, duration - 0.05));
        await new Promise<void>(res => { v.onseeked = () => res(); });
        wctx.drawImage(v, 0, 0, w, h);
        const frame = wctx.getImageData(0, 0, w, h);
        removeWatermarkReverseAlpha(frame.data, w, h, r, alphaMap);
        wctx.putImageData(frame, 0, 0);
        // hold frame for its time slice so output duration matches
        await new Promise(res => setTimeout(res, Math.max(0, 1000 / fps - 25)));
        setProgress(Math.round(((i + 1) / totalFrames) * 90) + 5);
        setStatus(`Processing frame ${i + 1}/${totalFrames}…`);
      }
      // tail to flush recorder
      await new Promise(res => setTimeout(res, 600));
      rec.stop();
      const blob = await done;
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setProgress(100); setStatus("");
      toast({
        title: conf > 0.6 ? "Video watermark removed." : "Video processed — check the preview.",
        variant: "success"
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Video processing failed.", variant: "error" });
    } finally {
      setBusy(false); setProgress(0); setStatus("");
    }
  }, [file, toast]);

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5">
      {/* mode tabs */}
      <div className="flex gap-2">
        {(["image", "video"] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setTab(m); reset(); }}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold capitalize transition ${
              tab === m
                ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/25"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {m === "image" ? "🖼️ Image" : "🎬 Video"}
          </button>
        ))}
      </div>

      {tab === "image" && (
        <>
          {/* method tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setMethod("auto")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                method === "auto"
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              ✨ Auto — Gemini exact removal
            </button>
            <button
              onClick={() => setMethod("manual")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                method === "manual"
                  ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}
            >
              🖌️ Manual brush — other marks
            </button>
          </div>

          {!file ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center transition hover:border-fuchsia-500/50 hover:bg-white/[0.05]">
              <span className="text-4xl">🖼️</span>
              <span className="text-sm font-medium text-zinc-300">Tap to upload an image</span>
              <span className="text-xs text-zinc-500">PNG / JPG — processed 100% on your device</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setupImage(f); }} />
            </label>
          ) : (
            <>
              {/* work canvas (hidden original kept for before/after) */}
              <canvas ref={beforeCanvasRef} className="hidden" />
              <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
                {method === "manual" ? (
                  <div className="relative touch-none select-none">
                    <canvas ref={imgCanvasRef} className="block w-full" />
                    <canvas
                      ref={maskCanvasRef}
                      className="absolute inset-0 block h-full w-full cursor-crosshair"
                      style={{ width: "100%", height: "100%" }}
                      onPointerDown={e => { painting.current = true; lastPos.current = null; (e.target as HTMLElement).setPointerCapture(e.pointerId); const m = maskCanvasRef.current!; paintAt(getPos(e, m)); }}
                      onPointerMove={e => { if (!painting.current) return; const m = maskCanvasRef.current!; paintAt(getPos(e, m)); }}
                      onPointerUp={() => { painting.current = false; lastPos.current = null; }}
                      onPointerCancel={() => { painting.current = false; lastPos.current = null; }}
                    />
                  </div>
                ) : (
                  <canvas ref={imgCanvasRef} className="block w-full" />
                )}
                {/* mask canvas must exist in both modes for sizing; hide in auto */}
                {method === "auto" && <canvas ref={maskCanvasRef} className="hidden" />}
              </div>

              {/* before / after slider */}
              {afterUrl && beforeUrl && (
                <div className="space-y-2">
                  <div
                    className="relative touch-none select-none overflow-hidden rounded-2xl ring-1 ring-white/10"
                    onPointerDown={e => {
                      const el = e.currentTarget;
                      const move = (ev: PointerEvent) => {
                        const r = el.getBoundingClientRect();
                        setSlider(Math.max(2, Math.min(98, ((ev.clientX - r.left) / r.width) * 100)));
                      };
                      move(e.nativeEvent);
                      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                      window.addEventListener("pointermove", move);
                      window.addEventListener("pointerup", up);
                    }}
                  >
                    <img src={afterUrl} alt="Cleaned" className="block w-full" draggable={false} />
                    <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
                      <img src={beforeUrl} alt="Original" className="block h-full max-w-none" style={{ width: `${100 / (slider / 100)}%` }} draggable={false} />
                    </div>
                    <div className="absolute inset-y-0" style={{ left: `${slider}%` }}>
                      <div className="h-full w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-1 text-xs font-bold text-black shadow-lg">⇔</div>
                    </div>
                    <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">Before</span>
                    <span className="absolute right-2 top-2 rounded-md bg-emerald-500/80 px-2 py-0.5 text-[11px] font-semibold text-white">After</span>
                  </div>
                  <p className="text-center text-xs text-zinc-500">Drag the handle to compare before / after</p>
                </div>
              )}

              {/* brush controls */}
              {method === "manual" && !afterUrl && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                  <div className="flex gap-1 rounded-lg bg-black/30 p-1">
                    {(["brush", "eraser"] as const).map(pm => (
                      <button key={pm} onClick={() => setPaintMode(pm)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${paintMode === pm ? "bg-fuchsia-600 text-white" : "text-zinc-400"}`}>
                        {pm === "brush" ? "🖌️ Brush" : "🧽 Eraser"}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    Size
                    <input type="range" min={6} max={120} value={brushSize} onChange={e => setBrushSize(+e.target.value)} className="w-28 accent-fuchsia-500" />
                    <span className="w-8 text-zinc-300">{brushSize}</span>
                  </label>
                  <button onClick={() => { maskCanvasRef.current?.getContext("2d")?.clearRect(0, 0, imgDims.w, imgDims.h); setHasMask(false); }}
                    className="ml-auto rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10">
                    Clear mask
                  </button>
                </div>
              )}

              {/* progress */}
              {busy && (
                <div className="space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-center text-xs text-zinc-400">{status}</p>
                </div>
              )}

              {/* actions */}
              <div className="flex flex-wrap gap-2">
                {!afterUrl ? (
                  method === "auto" ? (
                    <button onClick={autoRemoveImage} disabled={busy}
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:opacity-50">
                      {busy ? "Working…" : "✨ Remove watermark (exact)"}
                    </button>
                  ) : (
                    <button onClick={manualRemoveImage} disabled={busy || !hasMask}
                      className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 disabled:opacity-50">
                      {busy ? "Working…" : "🖌️ Remove painted area"}
                    </button>
                  )
                ) : (
                  <>
                    <button onClick={downloadImage}
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110">
                      ⬇️ Download cleaned image
                    </button>
                    <button onClick={() => { const b = beforeCanvasRef.current, c = imgCanvasRef.current; if (b && c) { c.getContext("2d")!.drawImage(b, 0, 0); } setAfterUrl(null); setConfidence(null); }}
                      className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-300 ring-1 ring-white/10 hover:bg-white/10">
                      ↺ Start over
                    </button>
                  </>
                )}
                <button onClick={reset} className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 ring-1 ring-white/10 hover:bg-white/10">
                  New image
                </button>
              </div>

              {method === "auto" && !afterUrl && (
                <p className="rounded-xl bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200/80 ring-1 ring-emerald-500/20">
                  ✨ <b>Exact mode</b> uses the real Reverse Alpha Blending method (open-source, MIT) with
                  calibrated Gemini watermark masks — mathematically exact restoration, no AI guessing.
                  For any other logo/text mark, use <b>Manual brush</b>.
                </p>
              )}
            </>
          )}
        </>
      )}

      {tab === "video" && (
        <>
          {!file ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center transition hover:border-fuchsia-500/50 hover:bg-white/[0.05]">
              <span className="text-4xl">🎬</span>
              <span className="text-sm font-medium text-zinc-300">Tap to upload a video</span>
              <span className="text-xs text-zinc-500">MP4 / WebM — watermark removed frame-by-frame, on-device</span>
              <input type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setupVideo(f); }} />
            </label>
          ) : (
            <>
              <video ref={videoRef} controls playsInline className="hidden" />
              {!videoUrl ? (
                <div className="space-y-3">
                  {videoBeforeUrl && (
                    <video src={videoBeforeUrl} controls playsInline className="block w-full overflow-hidden rounded-2xl ring-1 ring-white/10" />
                  )}
                  {busy && (
                    <div className="space-y-1.5">
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-center text-xs text-zinc-400">{status}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={autoRemoveVideo} disabled={busy}
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:opacity-50">
                      {busy ? "Working…" : "✨ Remove watermark from video"}
                    </button>
                    <button onClick={reset} className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 ring-1 ring-white/10 hover:bg-white/10">
                      New video
                    </button>
                  </div>
                  <p className="rounded-xl bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200/80 ring-1 ring-emerald-500/20">
                    ✨ Each frame is cleaned with exact <b>Reverse Alpha Blending</b> (same real method as images),
                    then re-encoded on your device. Output is WebM.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <video src={videoUrl} controls playsInline autoPlay loop className="block w-full overflow-hidden rounded-2xl ring-1 ring-emerald-500/30" />
                  <p className="text-center text-xs text-emerald-300">✅ Cleaned video — preview above before downloading</p>
                  <div className="flex gap-2">
                    <a href={videoUrl} download="watermark-removed.webm"
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110">
                      ⬇️ Download cleaned video
                    </a>
                    <button onClick={reset} className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 ring-1 ring-white/10 hover:bg-white/10">
                      New video
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* credit */}
      <p className="pt-1 text-center text-[11px] leading-relaxed text-zinc-600">
        Exact removal powered by the open-source <b>gemini-watermark-remover</b> method by GargantuaX
        (MIT License, original method © 2024 AllenK / Kwyshell).
        Everything runs 100% in your browser — your files never leave your device.
      </p>
    </div>
  );
}
