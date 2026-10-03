"use client";

import { useRef, useState } from "react";
import { Download, ImagePlus, Loader2, Minimize2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatBytes, cn } from "@/lib/utils";
import { saveBlob } from "@/lib/db";

type OutFormat = "webp" | "jpeg" | "png";
const FORMATS: { id: OutFormat; label: string; hint: string }[] = [
  { id: "webp", label: "WebP", hint: "smallest" },
  { id: "jpeg", label: "JPG", hint: "compatible" },
  { id: "png", label: "PNG", hint: "lossless" },
];

const MAX_DIMS = [
  { id: 0, label: "Original" },
  { id: 3840, label: "4K" },
  { id: 1920, label: "1920px" },
  { id: 1280, label: "1280px" },
  { id: 800, label: "800px" },
];

// Browsers (esp. mobile) choke on gigantic canvases. Cap at 16MP for safety.
const MAX_PIXELS = 16_000_000;

export default function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [quality, setQuality] = useState(80);
  const [maxDim, setMaxDim] = useState(0);
  const [format, setFormat] = useState<OutFormat>("webp");
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onFile = (f?: File) => {
    if (!f || !f.type.startsWith("image/")) {
      if (f) toast({ title: "Please choose an image file", variant: "error" });
      return;
    }
    setFile(f); setResult(null); setNote(""); setPreview(URL.createObjectURL(f));
  };

  const compress = async () => {
    if (!file) return;
    setBusy(true);
    setNote("");
    try {
      const bitmap = await createImageBitmap(file);
      let { width, height } = bitmap;

      // Safety: auto-shrink images that would blow up mobile memory.
      const pixels = width * height;
      let autoScaled = false;
      if (pixels > MAX_PIXELS) {
        const scale = Math.sqrt(MAX_PIXELS / pixels);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        autoScaled = true;
      }
      if (maxDim > 0) {
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const mime = `image/${format}`;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, mime, format === "png" ? undefined : quality / 100)
      );
      if (!blob) throw new Error("encode failed");
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
      // Persist so the output survives refresh — best-effort, never blocks UX.
      try {
        const name = `compressed-${file.name.replace(/\.[^.]+$/, "")}.${format === "jpeg" ? "jpg" : format}`;
        void saveBlob("image", blob, name, { tool: "compressor" });
      } catch {
        /* library save is non-critical */
      }
      if (autoScaled) setNote(`Auto-scaled for safety (${bitmap.width}×${bitmap.height} → ${width}×${height})`);
      const saved = Math.round((1 - blob.size / file.size) * 100);
      toast({ title: "Compressed", variant: "success", description: saved > 0 ? `${saved}% smaller` : "Done" });
    } catch {
      toast({ title: "Compression failed", variant: "error", description: "Try a smaller image" });
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
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Drop an image here or <span className="text-brand-700 dark:text-brand-400">browse</span></p>
            <p className="text-xs text-zinc-500 mt-1">100% client-side — your image never leaves the browser</p>
          </div>
        )}
      </div>

      {file && (
        <>
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Output format</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} onClick={() => setFormat(f.id)}
                  className={cn("btn-base px-4 py-2 text-sm rounded-lg border",
                    format === f.id ? "bg-brand-600/25 border-brand-500/50 text-zinc-900 dark:text-white" : "glass text-zinc-600 dark:text-zinc-400")}>
                  {f.label} <span className="text-xs opacity-60">· {f.hint}</span>
                </button>
              ))}
            </div>
          </div>
          {format !== "png" && (
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Quality: {quality}%</p>
              <input type="range" min={10} max={100} value={quality}
                onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-violet-500" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Max dimension</p>
            <div className="flex flex-wrap gap-2">
              {MAX_DIMS.map((d) => (
                <button key={d.id} onClick={() => setMaxDim(d.id)}
                  className={cn("btn-base px-4 py-2 text-sm rounded-lg border",
                    maxDim === d.id ? "bg-brand-600/25 border-brand-500/50 text-zinc-900 dark:text-white" : "glass text-zinc-600 dark:text-zinc-400")}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={compress} disabled={busy} className="w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Minimize2 size={16} />}
            {busy ? "Compressing…" : "Compress image"}
          </Button>
          {note && <p className="text-xs text-amber-700 dark:text-amber-300/80">{note}</p>}
          {result && (
            <div className="space-y-3 animate-fade-up">
              <div>
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-widest">Preview — compressed result</p>
                <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 grid place-items-center bg-black/[0.03] dark:bg-white/5 p-4">
                  <img src={result.url} alt="Compressed result" className="max-h-64 rounded-lg" />
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">
                    {Math.round((1 - result.size / file.size) * 100)}% smaller
                  </p>
                  <p className="text-zinc-500 text-xs">{formatBytes(file.size)} → {formatBytes(result.size)}</p>
                </div>
                <a href={result.url} download={`compressed-${file.name.replace(/\.[^.]+$/, "")}.${format === "jpeg" ? "jpg" : format}`}>
                  <Button size="sm"><Download size={14} /> Download</Button>
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
