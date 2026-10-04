"use client";

import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { ArrowDown, ArrowUp, Download, FilePlus2, FileText, Loader2, Trash2, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatBytes, cn } from "@/lib/utils";
import { saveBlob } from "@/lib/db";
import { saveToLibrary } from "@/lib/library-save";

const MAX_FILES = 20;
const MAX_SIZE = 25 * 1024 * 1024;

interface PdfFile {
  id: number;
  file: File;
}

let nextId = 0;

export default function PdfMerger() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const valid: PdfFile[] = [];
    for (const f of incoming) {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        toast({ title: "Only PDF files allowed", variant: "error", description: `${f.name} was skipped.` });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: "File too large", variant: "error", description: `${f.name} exceeds 25 MB.` });
        continue;
      }
      valid.push({ id: ++nextId, file: f });
    }
    setFiles((prev) => {
      const merged = [...prev, ...valid];
      if (merged.length > MAX_FILES) {
        toast({ title: `Maximum ${MAX_FILES} files`, variant: "error", description: "Extra files were skipped." });
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
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const clearAll = () => {
    setFiles([]);
    setResult(null);
  };

  const merge = async () => {
    if (files.length < 2) {
      toast({ title: "Add at least 2 PDFs", variant: "error", description: "Merging needs two or more files." });
      return;
    }
    setBusy(true);
    setProgress({ current: 0, total: files.length });
    try {
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const buf = await files[i].file.arrayBuffer();
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const bytes = await merged.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
      try {
        void saveToLibrary("pdf", blob, "merged.pdf", { tool: "pdf-merge" });
      } catch {
        /* library save is non-critical */
      }
      toast({ title: "PDFs merged", variant: "success", description: `${files.length} files combined.` });
    } catch {
      toast({ title: "Merge failed", variant: "error", description: "One of the files may be corrupted or password-protected." });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  return (
    <Card className="space-y-5">
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => (e.preventDefault(), e.dataTransfer.files.length && addFiles(e.dataTransfer.files))}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-black/15 dark:border-white/15 hover:border-brand-500/50 rounded-2xl p-8 text-center cursor-pointer transition"
      >
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
        <div className="py-6">
          <FilePlus2 size={36} className="mx-auto text-zinc-500 mb-3" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Drop PDFs here or <span className="text-brand-700 dark:text-brand-400">browse</span></p>
          <p className="text-xs text-zinc-500 mt-1">Up to {MAX_FILES} files · 25 MB each · 100% client-side</p>
        </div>
      </div>

      {files.length > 0 && (
        <>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={f.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <span className="shrink-0 w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-500/30 grid place-items-center text-xs font-bold text-brand-700 dark:text-brand-300">
                  {i + 1}
                </span>
                <FileText size={18} className="shrink-0 text-red-600 dark:text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{f.file.name}</p>
                  <p className="text-xs text-zinc-500">{formatBytes(f.file.size)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                    className={cn("p-2 rounded-lg border transition", i === 0 ? "opacity-30 border-black/10 dark:border-white/10" : "border-black/15 dark:border-white/15 hover:border-brand-500/60 hover:text-zinc-900 dark:hover:text-white text-zinc-600 dark:text-zinc-400")}>
                    <ArrowUp size={14} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === files.length - 1} aria-label="Move down"
                    className={cn("p-2 rounded-lg border transition", i === files.length - 1 ? "opacity-30 border-black/10 dark:border-white/10" : "border-black/15 dark:border-white/15 hover:border-brand-500/60 hover:text-zinc-900 dark:hover:text-white text-zinc-600 dark:text-zinc-400")}>
                    <ArrowDown size={14} />
                  </button>
                  <button onClick={() => removeAt(i)} aria-label="Remove file"
                    className="p-2 rounded-lg border border-black/15 dark:border-white/15 text-zinc-600 dark:text-zinc-400 hover:border-red-500/60 hover:text-red-600 dark:hover:text-red-400 transition">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">{files.length} file{files.length > 1 ? "s" : ""} · {formatBytes(totalSize)}</p>
            <button onClick={clearAll} className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400 text-xs flex items-center gap-1 transition">
              <Trash2 size={13} /> Clear all
            </button>
          </div>

          <Button onClick={merge} disabled={busy} className="w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <FilePlus2 size={16} />}
            {busy && progress
              ? `Merging… ${progress.current}/${progress.total}`
              : `Merge ${files.length} PDFs`}
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
            <div className="space-y-3 animate-fade-up">
              <div>
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-widest">Preview — merged PDF</p>
                <iframe src={result.url} title="Merged PDF preview" className="w-full h-96 rounded-xl border border-black/10 dark:border-white/10 bg-white" />
              </div>
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">Merged PDF ready</p>
                  <p className="text-zinc-500 text-xs">{formatBytes(result.size)}</p>
                </div>
                <a href={result.url} download="merged.pdf">
                  <Button size="sm"><Download size={14} /> Download PDF</Button>
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
