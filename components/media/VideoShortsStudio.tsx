"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Download, Film, Loader2, Pause, Play,
  Scissors, Sparkles, Type, Upload,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  RATIOS, type RatioId, activeLineAt, activeWordAt, buildCaptionTimeline,
  computeCrop, dragToFrameDelta, exportFileName, formatTime, outputSize,
} from "@/lib/video-shorts";

type BgMode = "blur" | "color" | "black";
type CapStyle = "hormozi" | "beast" | "neon";

const DEFAULT_CAPTIONS = `Film once.
Go vertical.
No re-editing.`;

const CAP_STYLES: { id: CapStyle; label: string; hint: string }[] = [
  { id: "hormozi", label: "Hormozi", hint: "Yellow pop word" },
  { id: "beast", label: "Bold Outline", hint: "White + black stroke" },
  { id: "neon", label: "Neon Glow", hint: "Cyan glow word" },
];

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export default function VideoShortsStudio() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const exportingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const lastProgressRef = useRef(-1);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [meta, setMeta] = useState<{ duration: number; w: number; h: number } | null>(null);
  const [ratio, setRatio] = useState<RatioId>("9:16");
  const [quality, setQuality] = useState<"720p" | "1080p">("720p");
  const [frameX, setFrameX] = useState(0.5);
  const [frameY, setFrameY] = useState(0.5);
  const [bg, setBg] = useState<BgMode>("blur");
  const [bgColor, setBgColor] = useState("#7c3aed");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [captionText, setCaptionText] = useState(DEFAULT_CAPTIONS);
  const [capStyle, setCapStyle] = useState<CapStyle>("hormozi");
  const [capSize, setCapSize] = useState(64);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const size = outputSize(ratio, quality);
  const timeline = buildCaptionTimeline(captionText, trimStart, trimEnd || 0);

  /* ---------- video loading ---------- */
  const loadVideoFile = useCallback((file: File) => {
    const okType = file.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name);
    if (!okType) {
      setError("Please choose a video file (MP4, MOV, WebM, MKV, AVI).");
      return;
    }
    setError(null);
    setExportUrl(null);
    setExportName("");
    setPlaying(false);
    setCurrentTime(0);
    setTrimStart(0);
    setFrameX(0.5);
    setFrameY(0.5);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFileName(file.name);
  }, []);

  const onMeta = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    setMeta({ duration, w: v.videoWidth, h: v.videoHeight });
    setTrimEnd(Math.min(duration, 60));
    setTrimStart(0);
    v.currentTime = 0;
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- preview draw loop ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !videoUrl) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const fontPx = Math.round((capSize * size.w) / 720);

    const drawCaptions = (t: number) => {
      if (!captionsOn) return;
      const line = activeLineAt(timeline, t);
      if (!line) return;
      const active = activeWordAt(line, t);
      const maxWidth = size.w - 56;
      const measure = (s: string) => ctx.measureText(s).width;
      ctx.font = `800 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      // rows of {word, globalIndex}
      const flat = line.words.map((word, i) => ({ word, i }));
      const rows: { word: string; i: number }[][] = [];
      let row: { word: string; i: number }[] = [];
      for (const item of flat) {
        const trial = [...row, item].map((x) => x.word).join(" ");
        if (row.length > 0 && measure(trial) > maxWidth) {
          rows.push(row);
          row = [item];
        } else {
          row = [...row, item];
        }
      }
      if (row.length > 0) rows.push(row);
      const lineHeight = fontPx * 1.3;
      const totalH = rows.length * lineHeight;
      let y = size.h * 0.72 - totalH / 2 + lineHeight / 2;
      const spaceW = measure(" ");
      for (const r of rows) {
        const rowW = r.reduce((acc, it, idx) => acc + measure(it.word) + (idx > 0 ? spaceW : 0), 0);
        let x = (size.w - rowW) / 2;
        for (const it of r) {
          const isActive = it.i === active;
          const wordFontPx = isActive ? Math.round(fontPx * 1.15) : fontPx;
          ctx.font = `800 ${wordFontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          const w = measure(it.word);
          ctx.lineJoin = "round";
          if (capStyle === "neon") {
            ctx.shadowColor = "#22d3ee";
            ctx.shadowBlur = isActive ? 26 : 8;
            ctx.fillStyle = isActive ? "#22d3ee" : "#e0f2fe";
            ctx.strokeStyle = "rgba(0,0,0,0.55)";
            ctx.lineWidth = Math.max(2, fontPx / 14);
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = isActive ? "#fde047" : "#ffffff";
            ctx.strokeStyle = "rgba(0,0,0,0.85)";
            ctx.lineWidth = Math.max(3, fontPx / 7);
          }
          ctx.strokeText(it.word, x, y);
          ctx.fillText(it.word, x, y);
          ctx.shadowBlur = 0;
          x += w + spaceW;
        }
        y += lineHeight;
      }
    };

    const draw = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const t = v.currentTime;
      const cctx = c.getContext("2d");
      if (!cctx) return;
      // background
      if (bg === "blur") {
        cctx.filter = "blur(28px) brightness(0.55)";
        cctx.drawImage(v, 0, 0, c.width, c.height);
        cctx.filter = "none";
      } else if (bg === "color") {
        cctx.fillStyle = bgColor;
        cctx.fillRect(0, 0, c.width, c.height);
      } else {
        cctx.fillStyle = "#000000";
        cctx.fillRect(0, 0, c.width, c.height);
      }
      // cropped video
      const crop = computeCrop(v.videoWidth, v.videoHeight, ratio, frameX, frameY);
      cctx.drawImage(v, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, c.width, c.height);
      drawCaptions(t);
      // export stop + progress
      if (exportingRef.current && trimEnd > trimStart) {
        const p = Math.min(1, Math.max(0, (t - trimStart) / (trimEnd - trimStart)));
        if (Math.abs(p - lastProgressRef.current) > 0.02) {
          lastProgressRef.current = p;
          setExportProgress(p);
        }
        if (t >= trimEnd - 0.05) finishExport();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, ratio, quality, frameX, frameY, bg, bgColor, captionsOn, captionText, capStyle, capSize, trimStart, trimEnd, size.w, size.h]);

  /* ---------- playback ---------- */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime >= trimEnd - 0.05) v.currentTime = trimStart;
      void v.play();
    } else {
      v.pause();
    }
  }, [trimEnd, trimStart]);

  /* ---------- drag to reframe ---------- */
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!meta) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!start || !canvas || !video || !meta) return;
    const rect = canvas.getBoundingClientRect();
    const dxPx = e.clientX - start.x;
    const dyPx = e.clientY - start.y;
    const crop = computeCrop(video.videoWidth, video.videoHeight, ratio, frameX, frameY);
    const d = dragToFrameDelta(dxPx, dyPx, rect.width, rect.height, crop, video.videoWidth, video.videoHeight);
    setFrameX((v) => Math.min(1, Math.max(0, v + d.dx)));
    setFrameY((v) => Math.min(1, Math.max(0, v + d.dy)));
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  /* ---------- audio graph (created once, only for export) ---------- */
  const ensureAudioGraph = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return null;
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const actx = new AC();
        const src = actx.createMediaElementSource(video);
        const dest = actx.createMediaStreamDestination();
        src.connect(dest);
        audioCtxRef.current = actx;
        audioDestRef.current = dest;
      }
      await audioCtxRef.current.resume();
      return audioDestRef.current;
    } catch {
      return null;
    }
  }, []);

  const finishExport = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.muted = true;
    }
    exportingRef.current = false;
    setExporting(false);
    setExportProgress(1);
  }, []);

  const startExport = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !meta || exportingRef.current) return;
    if (typeof MediaRecorder === "undefined") {
      setError("This browser cannot export video (MediaRecorder is not supported). Try Chrome or Edge on desktop.");
      return;
    }
    setError(null);
    setExportUrl(null);
    setExportProgress(0);
    lastProgressRef.current = -1;
    setExporting(true);
    exportingRef.current = true;
    try {
      const canvasStream = canvas.captureStream(30);
      let combined: MediaStream = canvasStream;
      const dest = await ensureAudioGraph();
      if (dest && dest.stream.getAudioTracks().length > 0) {
        combined = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      }
      const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(
        combined,
        mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : { videoBitsPerSecond: 8_000_000 },
      );
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setExportUrl(url);
        setExportName(exportFileName(ratio, Date.now()));
        toast({ title: "Short exported — ready to download", variant: "success" });
      };
      recorderRef.current = rec;
      video.muted = false;
      video.currentTime = trimStart;
      await video.play();
      rec.start(250);
    } catch (err) {
      exportingRef.current = false;
      setExporting(false);
      setError(err instanceof Error ? err.message : "Export failed. Please try again.");
      if (video) video.muted = true;
    }
  }, [meta, ratio, trimStart, ensureAudioGraph, toast]);

  /* ---------- demo clip (synthesized in-browser, no upload needed) ---------- */
  const loadDemo = useCallback(async () => {
    if (demoBusy) return;
    if (typeof MediaRecorder === "undefined") {
      setError("This browser cannot generate the demo clip (MediaRecorder is not supported).");
      return;
    }
    setDemoBusy(true);
    setError(null);
    try {
      const c = document.createElement("canvas");
      c.width = 1280;
      c.height = 720;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      const stream = c.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: "video/webm", videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });
      rec.start();
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          const t = (performance.now() - t0) / 1000;
          const grad = ctx.createLinearGradient(0, 0, 1280, 720);
          grad.addColorStop(0, `hsl(${(260 + t * 12) % 360} 70% 45%)`);
          grad.addColorStop(1, `hsl(${(200 + t * 12) % 360} 70% 35%)`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1280, 720);
          const bx = 640 + Math.sin(t * 1.4) * 380;
          const by = 360 + Math.cos(t * 2.1) * 140;
          ctx.fillStyle = "#fde047";
          ctx.beginPath();
          ctx.arc(bx, by, 90, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "800 84px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("YOUR VIDEO HERE", 640, 330);
          ctx.font = "600 40px system-ui, sans-serif";
          ctx.fillStyle = "#e0e7ff";
          ctx.fillText("Drag to reframe · Add captions · Export", 640, 410);
          if (t < 5) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      rec.stop();
      const blob = await done;
      loadVideoFile(new File([blob], "demo-clip.webm", { type: "video/webm" }));
      toast({ title: "Demo clip loaded — press play", variant: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the demo clip.");
    } finally {
      setDemoBusy(false);
    }
  }, [demoBusy, loadVideoFile, toast]);

  const trimRange = meta ? Math.max(0.5, trimEnd - trimStart) : 0;

  return (
    <div className="space-y-6">
      {/* hidden source video */}
      <video
        ref={videoRef}
        src={videoUrl ?? undefined}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={onMeta}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          if (!exportingRef.current && meta && t >= trimEnd - 0.05 && !e.currentTarget.paused) {
            e.currentTarget.pause();
            e.currentTarget.currentTime = trimStart;
          }
        }}
        onError={() => setError("Could not read this video file. Try an MP4 or WebM file.")}
        className="absolute w-px h-px opacity-0 pointer-events-none"
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Film className="w-5 h-5" /> Video Shorts Studio
          </span>
          <span className="text-xs text-zinc-500">Runs entirely in your browser — your video never leaves this device.</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadDemo} disabled={demoBusy}>
              {demoBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Try demo clip
            </Button>
            <label className="cursor-pointer px-4 py-2 text-xs rounded-full glass font-semibold hover:bg-black/5 dark:hover:bg-white/10">
              Upload video
              <input
                type="file"
                accept="video/*,.mkv,.mov,.avi"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadVideoFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {!videoUrl && (
          <label
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.03] px-6 py-14 text-center cursor-pointer hover:border-brand-500/60"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) loadVideoFile(f);
            }}
          >
            <Upload className="w-8 h-8 text-zinc-400" />
            <span className="font-semibold">Drop a horizontal video here, or click to upload</span>
            <span className="text-xs text-zinc-500">MP4 · MOV · WebM · MKV · AVI — processed locally, nothing is uploaded</span>
            <input
              type="file"
              accept="video/*,.mkv,.mov,.avi"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadVideoFile(f);
                e.target.value = "";
              }}
            />
          </label>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm bg-red-500/10 text-red-700 dark:text-red-300">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-xs sm:text-sm break-words">{error}</span>
          </div>
        )}

        {videoUrl && meta && (
          <div className="mt-2 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
            {/* preview */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {RATIOS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRatio(r.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${ratio === r.id ? "bg-brand-500 text-white border-brand-500" : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"}`}
                  >
                    {r.label} · {r.hint}
                  </button>
                ))}
                <span className="ml-auto text-xs text-zinc-500 self-center">
                  {fileName} · {meta.w}×{meta.h} · {formatTime(meta.duration)}
                </span>
              </div>

              <div className="flex justify-center rounded-2xl bg-black/80 dark:bg-black/60 p-3">
                <canvas
                  ref={canvasRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerUp}
                  className="max-h-[480px] w-auto max-w-full rounded-lg cursor-grab active:cursor-grabbing touch-none"
                  style={{ aspectRatio: `${size.w} / ${size.h}` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500 text-center">Drag the preview to reframe the shot · captions stay in the safe zone</p>

              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" onClick={togglePlay} disabled={exporting}>
                  {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {playing ? "Pause" : "Play"}
                </Button>
                <input
                  type="range"
                  min={trimStart}
                  max={trimEnd}
                  step={0.1}
                  value={Math.min(currentTime, trimEnd)}
                  onChange={(e) => {
                    const v = videoRef.current;
                    if (v) v.currentTime = Number(e.target.value);
                    setCurrentTime(Number(e.target.value));
                  }}
                  className="flex-1 accent-violet-600"
                  aria-label="Seek"
                />
                <span className="text-xs font-mono text-zinc-500 whitespace-nowrap">
                  {formatTime(currentTime)} / {formatTime(meta.duration)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="text-xs font-medium">
                  <span className="block text-zinc-500 mb-1">Trim start — {formatTime(trimStart)}</span>
                  <input
                    type="range" min={0} max={Math.max(0, (meta.duration || 0) - 0.5)} step={0.1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.5))}
                    className="w-full accent-violet-600"
                  />
                </label>
                <label className="text-xs font-medium">
                  <span className="block text-zinc-500 mb-1">Trim end — {formatTime(trimEnd)}</span>
                  <input
                    type="range" min={0.5} max={meta.duration || 0} step={0.1}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.5))}
                    className="w-full accent-violet-600"
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Clip length: {trimRange.toFixed(1)}s · exports record in real time, so a {Math.ceil(trimRange)}s clip takes ~{Math.ceil(trimRange)}s to export.
              </p>
            </div>

            {/* settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-2">BACKGROUND</label>
                <div className="flex flex-wrap gap-2">
                  {(["blur", "color", "black"] as BgMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setBg(m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize ${bg === m ? "bg-brand-500 text-white border-brand-500" : "border-black/10 dark:border-white/10"}`}
                    >
                      {m === "blur" ? "Blurred" : m === "color" ? "Solid color" : "Black"}
                    </button>
                  ))}
                  {bg === "color" && (
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-9 h-9 rounded-full cursor-pointer bg-transparent" aria-label="Background color" />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-500 flex items-center gap-1"><Type className="w-4 h-4" /> KARAOKE CAPTIONS</label>
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={captionsOn} onChange={(e) => setCaptionsOn(e.target.checked)} /> Show
                  </label>
                </div>
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  rows={3}
                  placeholder={"One phrase per line, e.g.\nFilm once.\nGo vertical."}
                  spellCheck={false}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-3 text-sm outline-none focus:ring-2 focus:ring-brand-500/50 resize-y"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {CAP_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setCapStyle(s.id)}
                      title={s.hint}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${capStyle === s.id ? "bg-brand-500 text-white border-brand-500" : "border-black/10 dark:border-white/10"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <label className="block text-xs text-zinc-500 mt-3">
                  Caption size — {capSize}px
                  <input type="range" min={40} max={96} step={2} value={capSize} onChange={(e) => setCapSize(Number(e.target.value))} className="w-full accent-violet-600" />
                </label>
                <p className="text-xs text-zinc-500 mt-1">Each line gets an equal slice of the clip; words light up one by one as the video plays.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-2">EXPORT</label>
                <label className="inline-flex items-center gap-2 text-xs font-medium">
                  Quality
                  <select value={quality} onChange={(e) => setQuality(e.target.value as "720p" | "1080p")} className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-xs outline-none">
                    <option value="720p">720p — faster</option>
                    <option value="1080p">1080p — sharper</option>
                  </select>
                </label>
                <Button size="sm" onClick={startExport} disabled={exporting} className="w-full mt-3">
                  {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                  {exporting ? `Exporting… ${Math.round(exportProgress * 100)}%` : "Export short (.webm)"}
                </Button>
                {exporting && (
                  <div className="mt-2 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className="h-full bg-violet-500 transition-all" style={{ width: `${exportProgress * 100}%` }} />
                  </div>
                )}
                {exportUrl && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span className="text-xs sm:text-sm break-words">
                      Done! Your vertical short is ready.{" "}
                      <a href={exportUrl} download={exportName} className="font-bold underline">Download {exportName}</a>
                    </span>
                  </div>
                )}
                <p className="mt-2 text-xs text-zinc-500">Exports as WebM video with audio — plays everywhere and uploads straight to TikTok, Reels and Shorts.</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Scissors className="w-4 h-4" /> How it works</h3>
        <ol className="list-decimal ml-5 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Upload a horizontal video (or try the demo clip) — it never leaves your device.</li>
          <li>Pick 9:16, 1:1 or 4:5, then drag the preview to frame the speaker.</li>
          <li>Choose a background (blurred, solid color, black) and type your captions — words light up karaoke-style.</li>
          <li>Trim the clip, press Export, and download your vertical short.</li>
        </ol>
      </Card>
    </div>
  );
}
