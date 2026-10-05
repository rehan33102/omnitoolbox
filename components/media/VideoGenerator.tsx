"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clapperboard, Plus, Trash2, ChevronUp, ChevronDown, Play, Pause,
  Download, ImagePlus, Loader2, RotateCcw, Film, Music,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatBytes } from "@/lib/utils";
import { saveToLibrary } from "@/lib/library-save";

interface Slide {
  id: string;
  imageDataUrl: string | null;
  title: string;
  subtitle: string;
  duration: number; // seconds
}

type VideoSize = "landscape" | "portrait";

const SIZES: Record<VideoSize, { w: number; h: number; label: string }> = {
  landscape: { w: 1280, h: 720, label: "YouTube (1280×720)" },
  portrait: { w: 1080, h: 1920, label: "Shorts / Reels (1080×1920)" },
};

const TRANSITION_MS = 600;
const FPS = 30;

let slideSeq = 0;
const newSlide = (): Slide => ({
  id: `slide-${Date.now()}-${slideSeq++}`,
  imageDataUrl: null,
  title: "",
  subtitle: "",
  duration: 4,
});

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Draw one slide at progress t (0..1) with Ken Burns zoom. */
function drawSlide(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  slide: Slide,
  t: number,
  W: number,
  H: number
) {
  // Background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0f0f16");
  g.addColorStop(1, "#1a1025");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Ken Burns: slow zoom 1.0 -> 1.12 with slight pan
  const zoom = 1 + 0.12 * t;
  if (img && img.complete && img.naturalWidth > 0) {
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = W / H;
    let dw = W, dh = H;
    if (ir > cr) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
    dw *= zoom; dh *= zoom;
    const dx = (W - dw) / 2 + (t - 0.5) * W * 0.03;
    const dy = (H - dh) / 2;
    ctx.save();
    // subtle dark overlay for text readability
    ctx.drawImage(img, dx, dy, dw, dh);
    const ov = ctx.createLinearGradient(0, H * 0.35, 0, H);
    ov.addColorStop(0, "rgba(0,0,0,0)");
    ov.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = ov;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Text overlays
  const padX = W * 0.07;
  const baseY = H * 0.78;
  ctx.textBaseline = "alphabetic";

  if (slide.title) {
    const fs = Math.round(W * 0.055);
    ctx.font = `800 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = Math.round(W * 0.012);
    ctx.shadowOffsetY = Math.round(W * 0.004);
    wrapText(ctx, slide.title, padX, baseY, W - padX * 2, fs * 1.25);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (slide.subtitle) {
    const fs = Math.round(W * 0.032);
    ctx.font = `500 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = Math.round(W * 0.008);
    wrapText(ctx, slide.subtitle, padX, baseY + fs * 1.9, W - padX * 2, fs * 1.45);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  // Slide counter badge
  ctx.font = `600 ${Math.round(W * 0.022)}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("OmniToolBox", padX, H * 0.06);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export default function VideoGenerator() {
  const { toast } = useToast();
  const [slides, setSlides] = useState<Slide[]>(() => [newSlide(), newSlide()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [size, setSize] = useState<VideoSize>("landscape");
  const [playing, setPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordPct, setRecordPct] = useState(0);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const animRef = useRef<number>(0);
  const playStartRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetSlideRef = useRef<string | null>(null);

  const { w: W, h: H } = SIZES[size];
  const totalDuration = slides.reduce((a, s) => a + Math.max(1, s.duration), 0);

  // Keep an <img> per slide image
  useEffect(() => {
    const map = imagesRef.current;
    const seen = new Set<string>();
    slides.forEach((s) => {
      if (!s.imageDataUrl) return;
      seen.add(s.id);
      const existing = map.get(s.id);
      if (!existing || existing.src !== s.imageDataUrl) {
        const img = new Image();
        img.src = s.imageDataUrl;
        map.set(s.id, img);
      }
    });
    for (const k of [...map.keys()]) if (!seen.has(k)) map.delete(k);
  }, [slides]);

  const updateSlide = (id: string, patch: Partial<Slide>) =>
    setSlides((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addSlide = () => {
    const s = newSlide();
    setSlides((ss) => [...ss, s]);
    setActiveId(s.id);
  };

  const removeSlide = (id: string) => {
    setSlides((ss) => {
      if (ss.length <= 1) {
        toast({ title: "Kam se kam 1 slide chahiye", variant: "error" });
        return ss;
      }
      return ss.filter((s) => s.id !== id);
    });
    setActiveId((a) => (a === id ? null : a));
  };

  const moveSlide = (id: string, dir: -1 | 1) => {
    setSlides((ss) => {
      const i = ss.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ss.length) return ss;
      const next = [...ss];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const pickImage = (slideId: string) => {
    targetSlideRef.current = slideId;
    fileInputRef.current?.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !targetSlideRef.current) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Sirf image file chahiye", variant: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateSlide(targetSlideRef.current!, { imageDataUrl: reader.result as string });
      toast({ title: "Image lag gayi ✅", variant: "success" });
    };
    reader.readAsDataURL(f);
  };

  // ---- Preview playback ----
  const renderAt = useCallback(
    (timeSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      let acc = 0;
      let idx = 0;
      for (; idx < slides.length; idx++) {
        const d = Math.max(1, slides[idx].duration);
        if (timeSec < acc + d) break;
        acc += d;
      }
      if (idx >= slides.length) idx = slides.length - 1;
      const slide = slides[idx];
      const d = Math.max(1, slide.duration);
      const local = Math.min(1, Math.max(0, (timeSec - acc) / d));

      const img = imagesRef.current.get(slide.id) ?? null;
      drawSlide(ctx, img, slide, local, W, H);

      // Fade transition at slide start
      const fadeT = Math.min(1, (timeSec - acc) / (TRANSITION_MS / 1000));
      if (fadeT < 1 && idx > 0) {
        ctx.fillStyle = `rgba(0,0,0,${1 - fadeT})`;
        ctx.fillRect(0, 0, W, H);
      }
    },
    [slides, W, H]
  );

  useEffect(() => {
    renderAt(playTime);
  }, [renderAt, playTime, size]);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    playStartRef.current = performance.now() - playTime * 1000;
    const tick = () => {
      const t = (performance.now() - playStartRef.current) / 1000;
      if (t >= totalDuration) {
        setPlayTime(0);
        setPlaying(false);
        return;
      }
      setPlayTime(t);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, totalDuration]);

  // ---- Voiceover preview (Web Speech API) ----
  const speakSlide = (slide: Slide) => {
    if (!("speechSynthesis" in window)) {
      toast({ title: "Voice preview is browser mein supported nahi", variant: "error" });
      return;
    }
    window.speechSynthesis.cancel();
    const text = [slide.title, slide.subtitle].filter(Boolean).join(". ");
    if (!text.trim()) {
      toast({ title: "Pehle title/subtitle likho", variant: "error" });
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    window.speechSynthesis.speak(u);
  };

  // ---- Record to WebM ----
  const generateVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (slides.every((s) => !s.imageDataUrl && !s.title && !s.subtitle)) {
      toast({ title: "Pehle slides mein content dalo", variant: "error" });
      return;
    }
    if (typeof canvas.captureStream !== "function") {
      toast({ title: "Tumhara browser recording support nahi karta", variant: "error" });
      return;
    }
    let mime = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm;codecs=vp8";
    if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";
    if (!MediaRecorder.isTypeSupported(mime)) {
      toast({ title: "MediaRecorder supported nahi", variant: "error" });
      return;
    }

    setRecording(true);
    setRecordPct(0);
    setResult(null);
    setPlaying(false);

    try {
      const stream = canvas.captureStream(FPS);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });
      rec.start(250);

      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          const t = (performance.now() - t0) / 1000;
          const p = Math.min(1, t / totalDuration);
          setRecordPct(Math.round(p * 100));
          renderAt(t);
          if (t >= totalDuration) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      // small tail so the last frame isn't cut
      await new Promise((r) => setTimeout(r, 300));
      rec.stop();
      const blob = await done;

      const url = URL.createObjectURL(blob);
      setResult({ url, size: blob.size });
      const name = `omnitoolbox-video-${uid()}.webm`;
      await saveToLibrary("video", blob, name, { tool: "video-generator", slides: slides.length });
      toast({
        title: "Video ready! 🎬",
        description: `${formatBytes(blob.size)} — library mein save ho gaya.`,
        variant: "success",
      });
    } catch (e) {
      toast({ title: "Recording failed", description: (e as Error).message, variant: "error" });
    } finally {
      setRecording(false);
      setRecordPct(0);
      setPlayTime(0);
    }
  };

  const resetAll = () => {
    if (!confirm("Saari slides clear kar dun?")) return;
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setPlayTime(0);
    setResult(null);
    const s = [newSlide(), newSlide()];
    setSlides(s);
    setActiveId(null);
  };

  const active = slides.find((s) => s.id === activeId) ?? null;

  return (
    <div className="space-y-5">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* Settings */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Film size={16} /> Video size:
          </div>
          {(Object.keys(SIZES) as VideoSize[]).map((k) => (
            <button
              key={k}
              onClick={() => setSize(k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                size === k
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-lg"
                  : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {SIZES[k].label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-sm text-zinc-500">
            <Music size={15} />
            Total: <b className="text-zinc-800 dark:text-zinc-100">{totalDuration}s</b> ·{" "}
            {slides.length} slides
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Slides list */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Slides</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={resetAll}>
                <RotateCcw size={14} /> Reset
              </Button>
              <Button size="sm" onClick={addSlide}>
                <Plus size={14} /> Add slide
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {slides.map((s, i) => (
              <div
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                  activeId === s.id
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                }`}
              >
                <div className="w-16 h-10 rounded-lg overflow-hidden bg-black/20 shrink-0 flex items-center justify-center">
                  {s.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageDataUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus size={16} className="opacity-40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {i + 1}. {s.title || <span className="opacity-40">Untitled</span>}
                  </p>
                  <p className="text-xs text-zinc-500">{s.duration}s</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    aria-label="Move up"
                    onClick={(e) => { e.stopPropagation(); moveSlide(s.id, -1); }}
                    className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    aria-label="Move down"
                    onClick={(e) => { e.stopPropagation(); moveSlide(s.id, 1); }}
                    className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    aria-label="Delete slide"
                    onClick={(e) => { e.stopPropagation(); removeSlide(s.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Active slide editor */}
          {active && (
            <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 space-y-3">
              <h4 className="font-semibold text-sm">Edit slide {slides.findIndex((s) => s.id === active.id) + 1}</h4>
              <Button size="sm" variant="secondary" onClick={() => pickImage(active.id)}>
                <ImagePlus size={14} /> {active.imageDataUrl ? "Change image" : "Upload image"}
              </Button>
              <Input
                label="Headline"
                value={active.title}
                onChange={(e) => updateSlide(active.id, { title: e.target.value })}
                placeholder="Breaking news headline…"
              />
              <Textarea
                label="Subtitle / description"
                value={active.subtitle}
                onChange={(e) => updateSlide(active.id, { subtitle: e.target.value })}
                placeholder="2-3 lines of detail…"
                rows={2}
              />
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Duration</label>
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  value={active.duration}
                  onChange={(e) => updateSlide(active.id, { duration: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-bold w-10 text-right">{active.duration}s</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => speakSlide(active)}>
                🔊 Voiceover preview
              </Button>
            </div>
          )}
        </Card>

        {/* Preview + generate */}
        <Card>
          <h3 className="font-display font-bold text-lg mb-3">Preview</h3>
          <div className="rounded-2xl overflow-hidden bg-black border border-black/10 dark:border-white/10">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="w-full h-auto block"
            />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (playTime >= totalDuration - 0.01) setPlayTime(0);
                setPlaying((p) => !p);
              }}
              disabled={recording}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Pause" : "Play preview"}
            </Button>
            <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-none"
                style={{ width: `${totalDuration ? (playTime / totalDuration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-mono text-zinc-500 w-16 text-right">
              {playTime.toFixed(1)}s / {totalDuration}s
            </span>
          </div>

          <div className="mt-5 pt-4 border-t border-black/10 dark:border-white/10">
            {recording ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Loader2 size={15} className="animate-spin" /> Recording… {recordPct}%
                </div>
                <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                    style={{ width: `${recordPct}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500">Tab ko band mat karo — video ban rahi hai 🎬</p>
              </div>
            ) : (
              <Button onClick={generateVideo} className="w-full" size="lg">
                <Clapperboard size={17} /> Generate Video 🎬
              </Button>
            )}

            {result && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="font-semibold text-sm mb-1">Video ready! ✅ ({formatBytes(result.size)})</p>
                <p className="text-xs text-zinc-500 mb-3">Library mein save ho gayi hai.</p>
                <a href={result.url} download={`omnitoolbox-video-${Date.now()}.webm`}>
                  <Button size="sm" className="w-full">
                    <Download size={14} /> Download WebM
                  </Button>
                </a>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="bg-amber-500/5 border-amber-500/20">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <b>Kaise kaam karta hai:</b> Slides banao → image + headline likho → Preview dekho →
          Generate dabao → WebM video download + library mein save. Sab kuch tumhare browser mein hota hai —
          koi upload nahi, 100% free! 🎉
          <br />
          <span className="text-xs opacity-70">Tip: Voiceover preview ke liye slide select karke 🔊 dabao.</span>
        </p>
      </Card>
    </div>
  );
}
