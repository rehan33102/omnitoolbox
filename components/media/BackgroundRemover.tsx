"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eraser, ImagePlus, Loader2, Sparkles, RefreshCw, TriangleAlert } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatBytes } from "@/lib/utils";

type RemoveFn = (image: Blob, config?: Record<string, unknown>) => Promise<Blob>;

const CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm",
  "https://esm.sh/@imgly/background-removal@1.5.5",
];

// Shared across mounts: the heavy AI engine loads once per page lifetime.
let enginePromise: Promise<RemoveFn> | null = null;

async function loadEngine(): Promise<RemoveFn> {
  if (!enginePromise) {
    enginePromise = (async () => {
      let lastErr: unknown = null;
      for (const url of CDN_URLS) {
        try {
          const mod = (await import(/* webpackIgnore: true */ url)) as { removeBackground: RemoveFn };
          const removeBackground = mod.removeBackground;
          // Silent warm-up: run once on a tiny image so the AI model
          // downloads NOW in the background — never while the user waits.
          try {
            const c = document.createElement("canvas");
            c.width = 32;
            c.height = 32;
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, 32, 32);
              const tiny = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
              if (tiny) await removeBackground(tiny, { progress: () => {} });
            }
          } catch {
            // Warm-up output doesn't matter; the real call retries the load.
          }
          return removeBackground;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removeFn = useRef<RemoveFn | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Start preparing the AI the moment this tab opens — silently, in the background.
  useEffect(() => {
    let alive = true;
    loadEngine()
      .then((fn) => {
        if (alive) {
          removeFn.current = fn;
          setEngine("ready");
        }
      })
      .catch(() => {
        if (alive) setEngine("failed");
      });
    return () => {
      alive = false;
    };
  }, []);

  const retryEngine = () => {
    setEngine("warming");
    setError(null);
    loadEngine()
      .then((fn) => {
        removeFn.current = fn;
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
    if (!file || !removeFn.current || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const small = await downscale(file, 1024);
      const blob = await removeFn.current(small);
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
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
        className="border-2 border-dashed border-white/15 hover:border-brand-500/50 rounded-2xl p-8 text-center cursor-pointer transition"
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {preview ? (
          <img src={preview} alt="Source" className="max-h-56 mx-auto rounded-xl" />
        ) : (
          <div className="py-6">
            <ImagePlus size={36} className="mx-auto text-zinc-500 mb-3" />
            <p className="text-sm text-zinc-300">Drop a photo here or <span className="text-brand-400">browse</span></p>
            <p className="text-xs text-zinc-500 mt-1">Private — AI runs on your device, nothing is uploaded</p>
          </div>
        )}
      </div>

      {/* Subtle engine status — never scary, never technical */}
      {engine === "warming" && (
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
          </span>
          Preparing the AI…
        </div>
      )}
      {engine === "failed" && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 flex items-start gap-3">
          <TriangleAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-200 font-medium">AI engine didn&apos;t start</p>
            <p className="text-xs text-red-200/70 mt-1">Check your internet connection and try again.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={retryEngine}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      )}

      {file && engine !== "failed" && (
        <>
          <Button onClick={remove} disabled={busy || engine !== "ready"} className="w-full">
            {busy || engine !== "ready" ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
            {engine !== "ready" ? "Preparing AI…" : busy ? "Removing background…" : "Remove background"}
          </Button>

          {/* Elegant working state — no percentages, no "download" talk */}
          {busy && (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="relative space-y-2">
                <Sparkles size={28} className="mx-auto text-brand-400 animate-pulse" />
                <p className="text-sm font-medium text-zinc-200">Working its magic…</p>
                <p className="text-xs text-zinc-500">The AI is separating your subject from the background</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 flex items-start gap-3 animate-fade-up">
              <TriangleAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-200">{error}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={remove}>
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
                <p className="text-sm text-zinc-400">{formatBytes(result.size)} · transparent PNG</p>
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
