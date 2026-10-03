"use client";

import { useRef, useState } from "react";
import { Download, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { saveBlob } from "@/lib/db";

type OutFormat = "png" | "jpeg" | "webp";
const FORMATS: { id: OutFormat; label: string }[] = [
  { id: "png", label: "PNG" },
  { id: "jpeg", label: "JPG" },
  { id: "webp", label: "WebP" },
];

export default function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [format, setFormat] = useState<OutFormat>("png");
  const [quality, setQuality] = useState(92);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onFile = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "error" });
      return;
    }
    setFile(f);
    setResult(null);
    setSavedNote(false);
    setPreview(URL.createObjectURL(f));
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      let { width, height } = bitmap;
      // Safety: cap gigantic images (e.g. 50MP phone photos) so mobile browsers don't crash.
      const MAX_PIXELS = 16_000_000;
      const pixels = width * height;
      if (pixels > MAX_PIXELS) {
        const scale = Math.sqrt(MAX_PIXELS / pixels);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, `image/${format}`, quality / 100)
      );
      if (!blob) throw new Error("encode failed");
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
      // Auto-save to My Library — best-effort.
      try {
        const id = await saveBlob("image", blob, `${file.name.replace(/\.[^.]+$/, "")}.${format}`, { format });
        if (id) setSavedNote(true);
      } catch {
        /* library save is non-critical */
      }
      toast({ title: "Converted", variant: "success", description: `${file.name} → ${format.toUpperCase()}` });
    } catch {
      toast({ title: "Conversion failed", variant: "error", description: "Try a smaller image" });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null); setPreview(""); setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card className="space-y-5">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), onFile(e.dataTransfer.files[0]))}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition",
          drag ? "border-brand-500 bg-brand-500/10" : "border-white/15 hover:border-brand-500/50"
        )}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {preview ? (
          <img src={preview} alt="Source" className="max-h-56 mx-auto rounded-xl" />
        ) : (
          <div className="py-6">
            <ImagePlus size={36} className="mx-auto text-zinc-500 mb-3" />
            <p className="text-sm text-zinc-300">Drop an image here or <span className="text-brand-400">browse</span></p>
            <p className="text-xs text-zinc-500 mt-1">PNG · JPG · WebP · GIF · AVIF — processed locally, never uploaded</p>
          </div>
        )}
      </div>

      {file && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400 truncate">{file.name}</span>
            <span className="text-zinc-500 shrink-0 ml-2">{formatBytes(file.size)}</span>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-300 mb-2">Output format</p>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn("btn-base px-4 py-2 text-sm rounded-lg border",
                    format === f.id ? "bg-brand-600/25 border-brand-500/50 text-white" : "glass text-zinc-400")}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {format !== "png" && (
            <div>
              <p className="text-sm font-medium text-zinc-300 mb-2">Quality: {quality}%</p>
              <input type="range" min={10} max={100} value={quality}
                onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-violet-500" />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={convert} disabled={busy} className="flex-1">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {busy ? "Converting…" : `Convert to ${format.toUpperCase()}`}
            </Button>
            <Button variant="ghost" onClick={reset}>Reset</Button>
          </div>

          {result && (
            <div className="glass rounded-xl p-4 flex items-center justify-between animate-fade-up">
              <div className="text-sm">
                <p className="font-medium">Ready to download</p>
                <p className="text-zinc-500 text-xs">{formatBytes(file.size)} → {formatBytes(result.size)}</p>
                {savedNote && <p className="text-emerald-400 text-xs mt-1">Saved to Library ✓</p>}
              </div>
              <a href={result.url} download={`${file.name.replace(/\.[^.]+$/, "")}.${format}`}>
                <Button size="sm"><Download size={14} /> Download</Button>
              </a>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
