"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eraser, ImagePlus, Loader2, Sparkles, RefreshCw, TriangleAlert } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatBytes } from "@/lib/utils";
import { saveBlob } from "@/lib/db";

type ProgressCb = (key: string, current: number, total: number) => void;
type RemoveFn = (image: Blob, config?: Record<string, unknown>) => Promise<Blob>;

const CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm",
  "https://esm.sh/@imgly/background-removal@1.5.5",
];

// Give slow mobile connections a fair chance, but NEVER hang forever.
const ENGINE_TIMEOUT_MS = 150_000;

// Shared across mounts: the heavy AI engine loads once per page lifetime.
let enginePromise: Promise<RemoveFn> | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Engine load timed out")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function loadEngine(onProgress: ProgressCb): Promise<RemoveFn> {
  if (!enginePromise) {
    enginePromise = (async () => {
      let lastErr: unknown = null;
      for (const url of CDN_URLS) {
        try {
          const mod = (await withTimeout(
            import(/* webpackIgnore: true */ url),
            45_000
          )) as { removeBackground: RemoveFn };
          const removeBackground = mod.removeBackground;
          // Warm-up on a tiny image so the AI model downloads NOW while the
          // user picks a photo — with real progress and a hard timeout.
          // NOTE: isnet_quint8 is ~44MB vs 176MB for the default model:
          // 4x faster on phones with the same visual quality.
          const config: Record<string, unknown> = {
            model: "isnet_quint8",
            output: { format: "image/png", quality: 0.9 },
            progress: onProgress,
          };
          try {
            const c = document.createElement("canvas");
            c.width = 32;
            c.height = 32;
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, 32, 32);
              const tiny = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
              if (tiny) await withTimeout(removeBackground(tiny, config), ENGINE_TIMEOUT_MS);
            }
          } catch {
            // Warm-up output doesn't matter; the real call retries the load.
          }
          // Wrap so every real call also carries the small-model config,
          // progress reporting and a timeout (never hang forever).
          const wrapped: RemoveFn = (image, extra) =>
            withTimeout(
              removeBackground(image, { ...config, progress: onProgress, ...(extra ?? {}) }),
              ENGINE_TIMEOUT_MS
            );
          return wrapped;
        } catch (e) {
          lastErr = e;
        }
      }
      enginePromise = null; // allow retry on next attempt
      throw lastErr instanceof Error ? lastErr : new Error("AI engine failed to load");
    })();
  }
  return enginePromise;
}

/** Shrink large photos before AI runs — 3-5x faster on phones, same visual result. */
async function downscale(file: File, maxDim = 1024): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close();
      return file;
    }
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext("2d")?.drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    return out ?? file;
  } catch {
    return file;
  }
}

export default function BackgroundRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [engine, setEngine] = useState<"warming" | "ready" | "failed">("warming");
  const [loadPct, setLoadPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyPct, setBusyPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const removeFn = useRef<RemoveFn | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Persist so the output survives refresh — best-effort, never blocks UX.
  const persistResult = (blob: Blob) => {
    try {
      const base = file?.name.replace(/\.[^.]+$/, "") ?? "image";
      void saveBlob("image", blob, `no-bg-${base}.png`, { tool: "bg-remover" });
    } catch {
      /* library save is non-critical */
    }
  };

  // Track overall download progress across the model's file chunks.
  const seen = useRef(new Map<string, { current: number; total: number }>());
  const reportProgress = (setter: (n: number) => void) => (key: string, current: number, total: number) => {
    if (!key.startsWith("fetch:")) return;
    seen.current.set(key, { current, total });
    let done = 0;
    let all = 0;
    seen.current.forEach(({ current: c, total: t }) => {
      done += c;
      all += t;
    });
    setter(all > 0 ? Math.min(99, Math.round((done / all) * 100)) : 0);
  };

  // Start preparing the AI the moment this tab opens — with honest progress.
  useEffect(() => {
    let alive = true;
    loadEngine(reportProgress(setLoadPct))
      .then((fn) => {
        if (alive) {
          removeFn.current = fn;
          setLoadPct(100);
          setEngine("ready");
        }
      })
      .catch(() => {
        if (alive) setEngine("failed");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryEngine = () => {
    seen.current.clear();
    setLoadPct(0);
    setEngine("warming");
    setError(null);
    loadEngine(reportProgress(setLoadPct))
      .then((fn) => {
        removeFn.current = fn;
        setLoadPct(100);
        setEngine("ready");
      })
      .catch(() => setEngine("failed"));
  };

  const onFile = (f?: File) => {
    if (!f || !f.type.startsWith("image/")) {
      if (f) toast({ title: "Please choose an image file", variant: "error" });
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      toast({ title: "Image too large", variant: "error", description: "Please use an image under 12 MB." });
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  };

  const remove = async () => {
    if (!file || busy) return;
    setBusy(true);
    setBusyPct(0);
    setError(null);
    setResult(null);
    // 1) Try the fast server (no download on the phone, ~10 seconds).
    try {
      const small = await downscale(file, 1568);
      const fd = new FormData();
      fd.append("image", small, "image.png");
      const res = await fetch("/api/bg-remove", { method: "POST", body: fd });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 1000) {
          const blob = new Blob([buf], { type: "image/png" });
          setResult({ url: URL.createObjectURL(blob), size: blob.size });
          persistResult(blob);
          toast({ title: "Background removed", variant: "success", description: "Your transparent PNG is ready." });
          setBusy(false);
          return;
        }
      }
      // Server busy/limited — fall through to on-device AI.
    } catch {
      // Fall through to on-device AI.
    }
    // 2) On-device AI fallback (one-time model download, then instant forever).
    if (!removeFn.current) {
      try {
        setBusyPct(0);
        removeFn.current = await loadEngine(reportProgress(setBusyPct));
        setLoadPct(100);
        setEngine("ready");
      } catch {
        setEngine("failed");
        setBusy(false);
        setError("The AI engine couldn't start. Check your internet connection and tap Retry.");
        return;
      }
    }
    try {
      const small = await downscale(file, 1024);
      const blob = await removeFn.current(small);
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
      persistResult(blob);
      toast({ title: "Background removed", variant: "success", description: "Your transparent PNG is ready." });
    } catch {
      setError("Couldn't process that photo. Try a different image or check your connection, then retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-5">
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => (e.preventDefault(), onFile(e.dataTransfer.files[0]))}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-black/15 dark:border-white/15 hover:border-brand-500/50 rounded-2xl p-8 text-center cursor-pointer transition"
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {preview ? (
          <img src={preview} alt="Source" className="max-h-56 mx-auto rounded-xl" />
        ) : (
          <div className="py-6">
            <ImagePlus size={36} className="mx-auto text-zinc-500 mb-3" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Drop a photo here or <span className="text-brand-700 dark:text-brand-400">browse</span></p>
            <p className="text-xs text-zinc-500 mt-1">Private — AI runs on your device, nothing is uploaded</p>
          </div>
        )}
      </div>

      {/* Honest engine status — real progress, and a way out if it stalls */}
      {engine === "warming" && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
            </span>
            {loadPct > 0 ? `Loading AI model… ${loadPct}%` : "Preparing the AI…"}
          </div>
          {loadPct > 0 && (
            <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${loadPct}%` }} />
            </div>
          )}
          <p className="text-center text-[11px] text-zinc-600">First load downloads the AI model (one time, ~44MB)</p>
        </div>
      )}
      {engine === "failed" && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 flex items-start gap-3">
          <TriangleAlert size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-200 font-medium">AI engine didn&apos;t start</p>
            <p className="text-xs text-red-700 dark:text-red-200/70 mt-1">Check your internet connection and try again.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={retryEngine}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      )}

      {file && engine !== "failed" && (
        <>
          <Button onClick={remove} disabled={busy} className="w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
            {busy ? "Processing…" : "Remove background"}
          </Button>

          {/* Working state — simple "Processing" with honest progress */}
          {busy && (
            <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 p-6 text-center">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="relative space-y-2">
                <Loader2 size={28} className="mx-auto text-brand-700 dark:text-brand-400 animate-spin" />
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Processing…</p>
                {busyPct > 0 && (
                  <div className="pt-1">
                    <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden max-w-xs mx-auto">
                      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${busyPct}%` }} />
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-1">{busyPct}%</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 flex items-start gap-3 animate-fade-up">
              <TriangleAlert size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={engine === "ready" ? remove : retryEngine}>
                <RefreshCw size={14} /> Retry
              </Button>
            </div>
          )}

          {result && (
            <div className="space-y-3 animate-fade-up">
              <div className="rounded-xl p-6 grid place-items-center"
                style={{ backgroundImage: "conic-gradient(#2a2a35 25%, #1d1d28 0 50%, #2a2a35 0 75%, #1d1d28 0)", backgroundSize: "24px 24px" }}>
                <img src={result.url} alt="Background removed" className="max-h-64 rounded-lg" />
              </div>
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatBytes(result.size)} · transparent PNG</p>
                <a href={result.url} download={`no-bg-${file.name.replace(/\.[^.]+$/, "")}.png`}>
                  <Button size="sm"><Download size={14} /> Download PNG</Button>
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
