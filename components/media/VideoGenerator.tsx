"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clapperboard, Plus, Trash2, ChevronUp, ChevronDown, Play, Pause,
  Download, ImagePlus, Loader2, RotateCcw, Film, Music, Newspaper,
  Mic, Radio, User,
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

/* ================= NEWS ANCHOR MODE ================= */

type GenMode = "slideshow" | "news";
type NewsTemplate = "breaking" | "standard" | "urgent";

const TEMPLATES: Record<
  NewsTemplate,
  { label: string; banner: string; accent: string; bg0: string; bg1: string; bannerText: string }
> = {
  breaking: {
    label: "🔴 Breaking News",
    banner: "#c81e1e",
    accent: "#fbbf24",
    bg0: "#200606",
    bg1: "#3a0d0d",
    bannerText: "BREAKING NEWS",
  },
  standard: {
    label: "🔵 Standard News",
    banner: "#1d4ed8",
    accent: "#93c5fd",
    bg0: "#060b1c",
    bg1: "#0c1836",
    bannerText: "NEWS",
  },
  urgent: {
    label: "⚫ Urgent Alert",
    banner: "#7f1d1d",
    accent: "#f87171",
    bg0: "#0a0a0a",
    bg1: "#200b0b",
    bannerText: "URGENT",
  },
};

interface NewsCue {
  start: number;
  end: number;
  text: string;
}

interface NewsFrameOpts {
  anchorName: string;
  channelName: string;
  template: NewsTemplate;
  ticker: string;
  cueText: string;
  audioActive: boolean;
}

/** Split a script into ≤550-char chunks on sentence boundaries (TTS limit is 600). */
function chunkScript(text: string, max = 550): string[] {
  const sentences =
    text.match(/[^.!?؛؟\n]+[.!?؛؟\n]+["'”]?|\S[^.!?؛؟\n]*$/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    const t = s.trim();
    if (!t) continue;
    if (cur && `${cur} ${t}`.length > max) {
      chunks.push(cur);
      cur = t;
    } else {
      cur = cur ? `${cur} ${t}` : t;
    }
  }
  if (cur) chunks.push(cur);
  const out: string[] = [];
  for (const c of chunks) {
    if (c.length <= max) out.push(c);
    else for (let i = 0; i < c.length; i += max) out.push(c.slice(i, i + max));
  }
  return out.filter(Boolean);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw one news-anchor frame. t = seconds since start, amp = 0..1 talking amplitude. */
function drawNewsFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  W: number,
  H: number,
  t: number,
  amp: number,
  o: NewsFrameOpts
) {
  const tpl = TEMPLATES[o.template];

  // ---- Studio backdrop ----
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, tpl.bg0);
  g.addColorStop(1, tpl.bg1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // radial glow behind anchor
  const cx = W / 2;
  const cy = H * 0.44;
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, W * 0.45);
  glow.addColorStop(0, `${tpl.accent}22`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // subtle dot pattern
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  const step = Math.max(28, W * 0.028);
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, W * 0.0012), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Top banner ----
  const bh = H * 0.105;
  ctx.fillStyle = tpl.banner;
  ctx.fillRect(0, 0, W, bh);
  // banner shine
  const shine = ctx.createLinearGradient(0, 0, 0, bh);
  shine.addColorStop(0, "rgba(255,255,255,0.22)");
  shine.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, W, bh);

  // blinking LIVE dot
  const blink = 0.55 + 0.45 * Math.sin(t * 6);
  const dotR = bh * 0.16;
  const dotX = W * 0.035;
  ctx.fillStyle = `rgba(255,255,255,${blink})`;
  ctx.beginPath();
  ctx.arc(dotX, bh / 2, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `800 ${Math.round(bh * 0.34)}px system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText("LIVE", dotX + dotR * 2.2, bh / 2 + 1);

  // banner headline
  ctx.font = `900 ${Math.round(bh * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(o.template === "standard" ? o.channelName.toUpperCase() : tpl.bannerText, cx, bh / 2 + 1);
  // channel name right
  ctx.textAlign = "right";
  ctx.font = `700 ${Math.round(bh * 0.28)}px system-ui, sans-serif`;
  ctx.fillText(o.channelName, W * 0.975, bh / 2 + 1);
  ctx.textAlign = "left";

  // ---- Anchor photo (circle) with talking animation ----
  const R = Math.min(W, H) * 0.21;
  const talking = o.audioActive ? amp : 0;
  const pulse = 1 + talking * 0.035 + Math.sin(t * 6) * (o.audioActive ? 0.006 : 0.003);
  const wobbleY = Math.sin(t * 7.3) * 3 * (o.audioActive ? Math.max(0.3, amp) : 0.15);
  const pr = R * pulse;

  ctx.save();
  // glow ring
  ctx.shadowColor = tpl.accent;
  ctx.shadowBlur = 24 + talking * 30;
  ctx.strokeStyle = tpl.accent;
  ctx.lineWidth = Math.max(4, W * 0.006);
  ctx.beginPath();
  ctx.arc(cx, cy + wobbleY, pr + ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // photo clipped to circle
  ctx.beginPath();
  ctx.arc(cx, cy + wobbleY, pr, 0, Math.PI * 2);
  ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    const ir = img.naturalWidth / img.naturalHeight;
    let dw = pr * 2, dh = pr * 2;
    if (ir > 1) { dw = pr * 2 * ir; } else { dh = (pr * 2) / ir; }
    // face-centered: bias slightly up
    ctx.drawImage(img, cx - dw / 2, cy + wobbleY - dh / 2 - pr * 0.12, dw, dh);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(cx - pr, cy + wobbleY - pr, pr * 2, pr * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `700 ${Math.round(pr * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("?", cx, cy + wobbleY + pr * 0.18);
    ctx.textAlign = "left";
  }
  ctx.restore();

  // ---- Lower third (slide-in) ----
  const slideIn = Math.min(1, t / 0.7);
  const ease = 1 - Math.pow(1 - slideIn, 3);
  const ltW = W * 0.52;
  const ltH = H * 0.105;
  const ltX = cx - ltW / 2;
  const ltY = cy + pr + H * 0.035;
  const hiddenX = -ltW - 40;
  const drawX = hiddenX + (ltX - hiddenX) * ease;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  roundRect(ctx, drawX, ltY, ltW, ltH, ltH * 0.18);
  ctx.fill();
  // accent bar
  ctx.fillStyle = tpl.banner;
  roundRect(ctx, drawX, ltY, ltW * 0.028, ltH, ltH * 0.18);
  ctx.fill();
  if (slideIn > 0.4) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(ltH * 0.34)}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    const name = o.anchorName || "News Anchor";
    ctx.fillText(name.slice(0, 28), drawX + ltW * 0.07, ltY + ltH * 0.32, ltW * 0.86);
    ctx.fillStyle = tpl.accent;
    ctx.font = `600 ${Math.round(ltH * 0.22)}px system-ui, sans-serif`;
    ctx.fillText(`${o.channelName} • Anchor`, drawX + ltW * 0.07, ltY + ltH * 0.72, ltW * 0.86);
  }
  ctx.restore();

  // ---- Subtitles ----
  if (o.cueText) {
    const fs = Math.round(W * 0.028);
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    const maxW = W * 0.86;
    const words = o.cueText.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
      if (lines.length === 2) break;
    }
    if (line && lines.length < 2) lines.push(line);
    const boxH = lines.length * fs * 1.45 + fs * 0.7;
    const boxY = H - H * 0.105 - boxH - H * 0.03;
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    roundRect(ctx, W * 0.07, boxY, W * 0.86, boxH, 12);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    lines.forEach((ln, i) => {
      ctx.fillText(ln, cx, boxY + fs * 0.65 + i * fs * 1.45 + fs * 0.35);
    });
    ctx.textAlign = "left";
  }

  // ---- Bottom ticker ----
  const th = H * 0.075;
  const ty = H - th;
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0, ty, W, th);
  ctx.fillStyle = tpl.banner;
  ctx.fillRect(0, ty, W, Math.max(3, th * 0.08));
  const ticker = (o.ticker || o.channelName).trim() || "NEWS";
  ctx.font = `700 ${Math.round(th * 0.42)}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const unit = `  •  ${ticker} `;
  const unitW = ctx.measureText(unit).width;
  const repeat = Math.ceil(W / unitW) + 2;
  const fullW = unitW * repeat;
  const speed = W * 0.12;
  let sx = W - ((t * speed) % fullW);
  ctx.fillStyle = "#ffffff";
  // clip ticker area
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, ty, W, th);
  ctx.clip();
  for (let i = 0; i < repeat; i++) {
    ctx.fillText(unit, sx + i * unitW, ty + th / 2 + 1);
  }
  // "TICKER" tag on left
  ctx.fillStyle = tpl.banner;
  const tagW = W * 0.13;
  ctx.fillRect(0, ty, tagW, th);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.round(th * 0.36)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("NEWS", tagW / 2, ty + th / 2 + 1);
  ctx.textAlign = "left";
  ctx.restore();

  // watermark
  ctx.font = `600 ${Math.round(W * 0.018)}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("OmniToolBox", W * 0.02, bh + H * 0.035);
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

  // ---- News Anchor mode state ----
  const [mode, setMode] = useState<GenMode>("slideshow");
  const [anchorPhoto, setAnchorPhoto] = useState<string | null>(null);
  const [anchorName, setAnchorName] = useState("");
  const [channelName, setChannelName] = useState("Omni News");
  const [newsScript, setNewsScript] = useState("");
  const [tickerText, setTickerText] = useState("");
  const [newsLang, setNewsLang] = useState("ur");
  const [newsVoice, setNewsVoice] = useState<"male" | "female">("male");
  const [newsTemplate, setNewsTemplate] = useState<NewsTemplate>("breaking");
  const [languages, setLanguages] = useState<{ code: string; label: string; flag: string }[]>([]);
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsStep, setNewsStep] = useState("");
  const [voicePreviewing, setVoicePreviewing] = useState(false);

  const anchorImgRef = useRef<HTMLImageElement | null>(null);
  const anchorFileRef = useRef<HTMLInputElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const newsAudioRef = useRef<{
    actx: AudioContext;
    buffer: AudioBuffer;
    cues: NewsCue[];
  } | null>(null);

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
    if (mode === "slideshow") renderAt(playTime);
  }, [renderAt, playTime, size, mode]);

  // ---- News Anchor: fetch TTS languages ----
  useEffect(() => {
    fetch("/api/voiceover/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.edge?.languages?.length) setLanguages(j.edge.languages);
      })
      .catch(() => {});
  }, []);

  // ---- News Anchor: keep an <img> for the anchor photo ----
  useEffect(() => {
    if (!anchorPhoto) {
      anchorImgRef.current = null;
      return;
    }
    const img = new Image();
    img.src = anchorPhoto;
    anchorImgRef.current = img;
  }, [anchorPhoto]);

  const pickAnchorPhoto = () => anchorFileRef.current?.click();

  const onAnchorFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Sirf image file chahiye", variant: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAnchorPhoto(reader.result as string);
      toast({ title: "Anchor photo lag gayi 📸", variant: "success" });
    };
    reader.readAsDataURL(f);
  };

  /** Current talking amplitude 0..1 from the analyser (0 when idle). */
  const getAmp = useCallback(() => {
    const an = analyserRef.current;
    if (!an) return 0;
    const buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    return Math.min(1, rms * 6);
  }, []);

  const renderNewsPreview = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawNewsFrame(ctx, anchorImgRef.current, W, H, t, getAmp(), {
        anchorName,
        channelName,
        template: newsTemplate,
        ticker: tickerText,
        cueText: newsScript.trim().split(/\n+/)[0]?.slice(0, 120) ?? "",
        audioActive: false,
      });
    },
    [W, H, getAmp, anchorName, channelName, newsTemplate, tickerText, newsScript]
  );

  // Idle news preview loop (ticker scrolls, banner blinks, anchor breathes)
  useEffect(() => {
    if (mode !== "news" || newsBusy) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      renderNewsPreview((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, newsBusy, renderNewsPreview]);

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
