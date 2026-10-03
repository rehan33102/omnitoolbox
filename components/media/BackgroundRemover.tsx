"use client";

import { useRef, useState } from "react";
import { Download, Eraser, ImagePlus, Loader2, Wifi } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatBytes } from "@/lib/utils";

export default function BackgroundRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
    setPreview(URL.createObjectURL(f));
  };

  const remove = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ label: "Loading AI engine…", pct: 0 });
    try {
      // Loaded from CDN at runtime (webpackIgnore) so the heavy WASM/AI payload
      // never enters the Next.js bundle. The ~40MB model downloads on first use.
      const CDN_URL = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";
      let mod: unknown;
      try {
        mod = await import(/* webpackIgnore: true */ CDN_URL);
      } catch {
        throw new Error("Could not load the AI engine. Check your internet connection and try again.");
      }
      const { removeBackground } = mod as {
        removeBackground: (image: Blob, config?: Record<string, unknown>) => Promise<Blob>;
      };
      setProgress({ label: "Downloading AI model (one-time, ~40 MB)…", pct: 2 });
      const blob = await removeBackground(file, {
        progress: (key: string, current: number, total: number) => {
          const short = key.split("/").pop() || key;
          const pct = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : 0;
          setProgress({ label: `Downloading ${short}…`, pct });
        },
      });
      setProgress({ label: "Finishing up…", pct: 100 });
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
      toast({ title: "Background removed", variant: "success", description: "Your transparent PNG is ready." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Removal failed — try a smaller image or check your connection.";
      toast({ title: "Removal failed", variant: "error", description: msg });
    } finally {
      setBusy(false);
      setProgress(null);
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
            <p className="text-xs text-zinc-500 mt-1">AI runs in your browser — nothing is uploaded</p>
          </div>
        )}
      </div>

      {file && (
        <>
          <Button onClick={remove} disabled={busy} className="w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
            {busy ? "Working…" : "Remove background"}
          </Button>

          {busy && progress && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Wifi size={14} className="text-brand-400" />
                <span className="truncate">{progress.label}</span>
                <span className="ml-auto shrink-0 font-medium text-zinc-300">{progress.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-300"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">First run downloads the AI model once — afterwards it&apos;s instant. WiFi recommended.</p>
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
