"use client";

import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, FileText, Loader2, Scissors, Upload } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatBytes } from "@/lib/utils";

const MAX_SIZE = 25 * 1024 * 1024;

/** Parse "1-3,5,8-9" into 1-based page numbers. Throws with a user-friendly message. */
function parseRange(input: string, pageCount: number): number[] {
  const cleaned = input.replace(/\s+/g, "");
  if (!cleaned) throw new Error("Enter a page range, e.g. 1-3,5");
  const pages: number[] = [];
  for (const part of cleaned.split(",")) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Invalid part "${part}" — use numbers like 1-3,5`);
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    if (start < 1 || end < 1) throw new Error("Page numbers start at 1");
    if (start > pageCount || end > pageCount)
      throw new Error(`Only ${pageCount} pages — "${part}" is out of range`);
    if (start > end) throw new Error(`"${part}" is backwards — start must be ≤ end`);
    for (let p = start; p <= end; p++) pages.push(p);
  }
  const unique = [...new Set(pages)];
  if (unique.length === 0) throw new Error("No valid pages found");
  return unique;
}

export default function PdfSplitter() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; size: number; pages: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onFile = async (f?: File) => {
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast({ title: "Only PDF files allowed", variant: "error" });
      return;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: "File too large", variant: "error", description: "Please use a PDF under 25 MB." });
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      setFile(f);
      setPageCount(doc.getPageCount());
      setResult(null);
      setRange("");
    } catch {
      toast({ title: "Could not read PDF", variant: "error", description: "The file may be corrupted or password-protected." });
    }
  };

  const extract = async () => {
    if (!file) return;
    let pages: number[];
    try {
      pages = parseRange(range, pageCount);
    } catch (err) {
      toast({ title: "Invalid page range", variant: "error", description: err instanceof Error ? err.message : undefined });
      return;
    }
    setBusy(true);
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map((p) => p - 1));
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      setResult({ url: URL.createObjectURL(blob), size: blob.size, pages: pages.length });
      toast({ title: "Pages extracted", variant: "success", description: `${pages.length} page${pages.length > 1 ? "s" : ""} saved to a new PDF.` });
    } catch {
      toast({ title: "Extraction failed", variant: "error", description: "Try again with a different file." });
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
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden"
          onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        {file ? (
          <div className="py-4 flex items-center justify-center gap-3">
            <FileText size={32} className="text-red-400 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium truncate max-w-[220px]">{file.name}</p>
              <p className="text-xs text-zinc-500">{formatBytes(file.size)} · <span className="text-brand-300 font-semibold">{pageCount} pages</span></p>
            </div>
          </div>
        ) : (
          <div className="py-6">
            <Upload size={36} className="mx-auto text-zinc-500 mb-3" />
            <p className="text-sm text-zinc-300">Drop a PDF here or <span className="text-brand-400">browse</span></p>
            <p className="text-xs text-zinc-500 mt-1">Single PDF · up to 25 MB · 100% client-side</p>
          </div>
        )}
      </div>

      {file && (
        <>
          <div>
            <label htmlFor="pdf-range" className="text-sm font-medium text-zinc-300 mb-2 block">
              Pages to extract
            </label>
            <input
              id="pdf-range"
              type="text"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="e.g. 1-3,5  (1 … pageCount)"
              className="w-full glass rounded-xl px-4 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/60 border border-transparent"
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              Single pages or ranges, separated by commas — e.g. <span className="text-zinc-300">1-3,5</span>. This PDF has {pageCount} pages.
            </p>
          </div>

          <Button onClick={extract} disabled={busy || !range.trim()} className="w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
            {busy ? "Extracting…" : "Extract pages"}
          </Button>

          {result && (
            <div className="glass rounded-xl p-4 flex items-center justify-between animate-fade-up">
              <div className="text-sm">
                <p className="font-medium text-emerald-300">{result.pages} page{result.pages > 1 ? "s" : ""} extracted</p>
                <p className="text-zinc-500 text-xs">{formatBytes(result.size)} · new PDF</p>
              </div>
              <a href={result.url} download={`extracted-pages.pdf`}>
                <Button size="sm"><Download size={14} /> Download PDF</Button>
              </a>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
