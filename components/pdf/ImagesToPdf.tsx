"use client";

import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { ArrowDown, ArrowUp, Download, ImagePlus, Images, Loader2, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatBytes, cn } from "@/lib/utils";

const MAX_FILES = 20;
const MAX_SIZE = 25 * 1024 * 1024;
const MAX_DIM = 2000; // cap canvas size to keep memory sane

// A4 in PDF points
const A4_W = 595.28;
const A4_H = 841.89;

interface ImgFile {
  id: number;
  file: File;
  preview: string;
}

let nextId = 0;

async function normalizeImage(file: File): Promise<{ data: ArrayBuffer; isPng: boolean; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const isPng = file.type === "image/png";
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, isPng ? "image/png" : "image/jpeg", 0.92)
  );
  if (!blob) throw new Error("encode failed");
  return { data: await blob.arrayBuffer(), isPng, width, height };
}

export default function ImagesToPdf() {
  const [files, setFiles] = useState<ImgFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const valid: ImgFile[] = [];
    for (const f of incoming) {
      if (!f.type.startsWith("image/")) {
        toast({ title: "Only images allowed", variant: "error", description: `${f.name} was skipped.` });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: "File too large", variant: "error", description: `${f.name} exceeds 25 MB.` });
        continue;
      }
      valid.push({ id: ++nextId, file: f, preview: URL.createObjectURL(f) });
    }
    setFiles((prev) => {
      const merged = [...prev, ...valid];
      if (merged.length > MAX_FILES) {
        toast({ title: `Maximum ${MAX_FILES} images`, variant: "error", description: "Extra images were skipped." });
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
    setResult(null);
  };

  const move = (index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeAt = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    setResult(null);
  };

  const build = async () => {
    if (files.length === 0) {
      toast({ title: "Add some images first", variant: "error" });
      return;
    }
    setBusy(true);
    setProgress({ current: 0, total: files.length });
    try {
      const doc = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const { data, isPng, width, height } = await normalizeImage(files[i].file);
        const embedded = isPng ? await doc.embedPng(data) : await doc.embedJpg(data);
        const page = doc.addPage([A4_W, A4_H]);
        const scale = Math.min(A4_W / width, A4_H / height);
        const w = width * scale;
        const h = height * scale;
        page.drawImage(embedded, { x: (A4_W - w) / 2, y: (A4_H - h) / 2, width: w, height: h });
      }
      const bytes = await doc.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
      toast({ title: "PDF created", variant: "success", description: `${files.length} image${files.length > 1 ? "s" : ""} → ${files.length} A4 page${files.length > 1 ? "s" : ""}.` });
    } catch {
      toast({ title: "PDF creation failed", variant: "error", description: "One of the images could not be processed." });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Card className="space-y-5">
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => (e.preventDefault(), e.dataTransfer.files.length && addFiles(e.dataTransfer.files))}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-black/15 dark:border-white/15 hover:border-brand-500/50 rounded-2xl p-8 text-center cursor-pointer transition"
      >
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
        <div className="py-6">
          <Images size={36} className="mx-auto text-zinc-500 mb-3" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Drop images here or <span className="text-brand-700 dark:text-brand-400">browse</span></p>
          <p className="text-xs text-zinc-500 mt-1">JPG · PNG · WebP · up to {MAX_FILES} images · 100% client-side</p>
        </div>
      </div>

      {files.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {files.map((f, i) => (
              <div key={f.id} className="glass rounded-xl p-2 space-y-2">
                <div className="relative rounded-lg overflow-hidden bg-black/30">
                  <img src={f.preview} alt={f.file.name} className="w-full h-28 object-cover" />
                  <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md bg-black/60 grid place-items-center text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <button onClick={() => removeAt(i)} aria-label="Remove image"
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/60 text-zinc-300 hover:text-red-400 transition">
                    <X size={13} />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 truncate px-1">{f.file.name}</p>
                <div className="flex gap-1 px-1 pb-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier"
                    className={cn("flex-1 p-1.5 rounded-lg border text-xs transition flex items-center justify-center gap-1", i === 0 ? "opacity-30 border-black/10 dark:border-white/10" : "border-black/15 dark:border-white/15 hover:border-brand-500/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}>
                    <ArrowUp size={12} /> Prev
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === files.length - 1} aria-label="Move later"
                    className={cn("flex-1 p-1.5 rounded-lg border text-xs transition flex items-center justify-center gap-1", i === files.length - 1 ? "opacity-30 border-black/10 dark:border-white/10" : "border-black/15 dark:border-white/15 hover:border-brand-500/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}>
                    Next <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <ImagePlus size={14} className="text-brand-700 dark:text-brand-400" />
            {files.length} image{files.length > 1 ? "s" : ""} → each becomes one centered A4 page
          </p>

          <Button onClick={build} disabled={busy} className="w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {busy && progress
              ? `Building PDF… ${progress.current}/${progress.total}`
              : "Create PDF"}
          </Button>

          {busy && progress && (
            <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-300"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
          )}

          {result && (
            <div className="glass rounded-xl p-4 flex items-center justify-between animate-fade-up">
              <div className="text-sm">
                <p className="font-medium text-emerald-700 dark:text-emerald-300">PDF ready</p>
                <p className="text-zinc-500 text-xs">{formatBytes(result.size)}</p>
              </div>
              <a href={result.url} download="images.pdf">
                <Button size="sm"><Download size={14} /> Download PDF</Button>
              </a>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
