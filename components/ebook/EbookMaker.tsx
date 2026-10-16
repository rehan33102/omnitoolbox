"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown, ArrowUp, BookOpen, Download, FileDown, ImagePlus, Loader2,
  Plus, Trash2, Type, X, RotateCcw,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn, formatBytes } from "@/lib/utils";
import {
  buildEpub, buildPdf, pdfFilename,
  type BookData, type EbookBlock, type EbookChapter,
} from "@/lib/ebook";

/* ------------------------------------------------------------------ */
/* Draft types (UI-side; images as data URLs so the draft survives a   */
/* refresh via localStorage).                                         */
/* ------------------------------------------------------------------ */

interface DraftBlockText { id: string; kind: "text"; text: string }
interface DraftBlockImage { id: string; kind: "image"; dataUrl: string; mime: "image/jpeg" | "image/png"; caption: string }
type DraftBlock = DraftBlockText | DraftBlockImage;

interface DraftChapter { id: string; title: string; blocks: DraftBlock[] }

interface Draft {
  title: string;
  author: string;
  language: string;
  coverImageDataUrl: string | null;
  coverImageMime: "image/jpeg" | "image/png" | null;
  gradientFrom: string;
  gradientTo: string;
  chapters: DraftChapter[];
}

const DRAFT_KEY = "ebook-maker-draft-v1";
const MAX_IMG_DIM = 1600;

const GRADIENTS: { name: string; from: string; to: string }[] = [
  { name: "Midnight", from: "#312e81", to: "#0f172a" },
  { name: "Sunset", from: "#c2410c", to: "#7c2d12" },
  { name: "Ocean", from: "#0e7490", to: "#164e63" },
  { name: "Forest", from: "#15803d", to: "#052e16" },
  { name: "Rose", from: "#be123c", to: "#4c0519" },
  { name: "Violet", from: "#7c3aed", to: "#2e1065" },
];

function nid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function blankDraft(): Draft {
  return {
    title: "", author: "", language: "en",
    coverImageDataUrl: null, coverImageMime: null,
    gradientFrom: GRADIENTS[0].from, gradientTo: GRADIENTS[0].to,
    chapters: [],
  };
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return blankDraft();
    const d = JSON.parse(raw) as Draft;
    if (!d || !Array.isArray(d.chapters)) return blankDraft();
    return { ...blankDraft(), ...d };
  } catch {
    return blankDraft();
  }
}

/** Normalize an uploaded image → JPEG/PNG data URL, capped in dimension. */
async function normalizeImage(file: File): Promise<{ dataUrl: string; mime: "image/jpeg" | "image/png" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMG_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext("2d")!;
  if (file.type === "image/png") {
    g.drawImage(bitmap, 0, 0, w, h);
  } else {
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
    g.drawImage(bitmap, 0, 0, w, h);
  }
  bitmap.close();
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, 0.9);
  return { dataUrl, mime };
}

async function dataUrlToBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(dataUrl);
  return res.arrayBuffer();
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function EbookMaker() {
  const [draft, setDraft] = useState<Draft | null>(null); // null until hydrated
  const [busy, setBusy] = useState<null | "epub" | "pdf">(null);
  const [result, setResult] = useState<{ url: string; filename: string; size: number; kind: "epub" | "pdf" } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const blockImgRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  // Hydrate draft (client-only) + autosave
  useEffect(() => {
    setDraft(loadDraft());
  }, []);
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedAt(new Date());
      } catch { /* quota */ }
    }, 500);
    return () => clearTimeout(t);
  }, [draft]);

  const stats = useMemo(() => {
    if (!draft) return { chapters: 0, words: 0, images: 0 };
    let words = 0, images = 0;
    for (const c of draft.chapters) {
      for (const b of c.blocks) {
        if (b.kind === "text") words += b.text.split(/\s+/).filter(Boolean).length;
        else images += 1;
      }
    }
    return { chapters: draft.chapters.length, words, images };
  }, [draft]);

  if (!draft) return null;

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const updateChapter = (id: string, patch: Partial<DraftChapter>) =>
    setDraft((d) => (d ? { ...d, chapters: d.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : d));

  const moveChapter = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const i = d.chapters.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.chapters.length) return d;
      const chs = [...d.chapters];
      [chs[i], chs[j]] = [chs[j], chs[i]];
      return { ...d, chapters: chs };
    });

  const updateBlock = (chId: string, bId: string, patch: Partial<DraftBlock>) =>
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        chapters: d.chapters.map((c) =>
          c.id === chId ? { ...c, blocks: c.blocks.map((b) => (b.id === bId ? ({ ...b, ...patch } as DraftBlock) : b)) } : c
        ),
      };
    });

  const moveBlock = (chId: string, bId: string, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        chapters: d.chapters.map((c) => {
          if (c.id !== chId) return c;
          const i = c.blocks.findIndex((b) => b.id === bId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= c.blocks.length) return c;
          const blocks = [...c.blocks];
          [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
          return { ...c, blocks };
        }),
      };
    });

  const deleteBlock = (chId: string, bId: string) =>
    updateChapter(chId, { blocks: draft.chapters.find((c) => c.id === chId)!.blocks.filter((b) => b.id !== bId) });

  const addTextBlock = (chId: string) =>
    updateChapter(chId, {
      blocks: [...draft.chapters.find((c) => c.id === chId)!.blocks, { id: nid(), kind: "text" as const, text: "" }],
    });

  const addImageBlock = async (chId: string, file: File) => {
    try {
      const { dataUrl, mime } = await normalizeImage(file);
      updateChapter(chId, {
        blocks: [...draft.chapters.find((c) => c.id === chId)!.blocks, { id: nid(), kind: "image" as const, dataUrl, mime, caption: "" }],
      });
    } catch {
      toast({ title: "Couldn't read that image", variant: "error", description: "Try a JPG or PNG." });
    }
  };

  const addChapter = () =>
    setDraft((d) => (d ? { ...d, chapters: [...d.chapters, { id: nid(), title: `Chapter ${d.chapters.length + 1}`, blocks: [] }] } : d));

  const deleteChapter = (id: string) =>
    setDraft((d) => (d ? { ...d, chapters: d.chapters.filter((c) => c.id !== id) } : d));

  const resetAll = () => {
    if (!window.confirm("Start a new book? This clears your current draft.")) return;
    localStorage.removeItem(DRAFT_KEY);
    setDraft(blankDraft());
    setSavedAt(null);
    setResult(null);
  };

  const onCoverFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { dataUrl, mime } = await normalizeImage(file);
      set({ coverImageDataUrl: dataUrl, coverImageMime: mime });
    } catch {
      toast({ title: "Couldn't read that image", variant: "error", description: "Try a JPG or PNG." });
    }
  };

  /** Convert the UI draft into the pure BookData used by the builders. */
  const toBookData = async (): Promise<BookData> => {
    const chapters: EbookChapter[] = [];
    for (const c of draft.chapters) {
      const blocks: EbookBlock[] = [];
      for (const b of c.blocks) {
        if (b.kind === "text") {
          if (b.text.trim()) blocks.push({ kind: "text", text: b.text.trim() });
        } else {
          blocks.push({
            kind: "image",
            imageData: await dataUrlToBuffer(b.dataUrl),
            mimeType: b.mime,
            caption: b.caption?.trim() || undefined,
          });
        }
      }
      chapters.push({ id: c.id, title: c.title.trim() || "Untitled chapter", blocks });
    }
    return {
      title: draft.title.trim() || "Untitled",
      author: draft.author.trim(),
      language: draft.language.trim() || "en",
      cover: {
        imageData: draft.coverImageDataUrl ? await dataUrlToBuffer(draft.coverImageDataUrl) : undefined,
        imageMime: draft.coverImageMime ?? undefined,
        gradientFrom: draft.gradientFrom,
        gradientTo: draft.gradientTo,
      },
      chapters,
    };
  };

  const downloadBlob = (blob: Blob, filename: string, kind: "epub" | "pdf") => {
    if (result) URL.revokeObjectURL(result.url);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setResult({ url, filename, size: blob.size, kind });
  };

  const exportBook = async (kind: "epub" | "pdf") => {
    if (draft.chapters.length === 0) {
      toast({ title: "Add at least one chapter before exporting", variant: "error" });
      return;
    }
    setBusy(kind);
    try {
      const book = await toBookData();
      if (kind === "epub") {
        const { blob, filename } = await buildEpub(book);
        downloadBlob(blob, filename, "epub");
        toast({ title: "EPUB downloaded", variant: "success", description: formatBytes(blob.size) });
      } else {
        const blob = await buildPdf(book);
        downloadBlob(blob, pdfFilename(book), "pdf");
        toast({ title: "PDF downloaded", variant: "success", description: formatBytes(blob.size) });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Export failed", variant: "error", description: "Try removing very large images." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Stats + actions */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {stats.chapters} chapters</span>
          <span>{stats.words.toLocaleString()} words</span>
          <span>{stats.images} images</span>
        </div>
        <Button variant="ghost" size="sm" onClick={resetAll} className="inline-flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4" /> Start new book
        </Button>
      </div>

      {/* Book setup */}
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">Book details</h2>
        <div className="grid md:grid-cols-[1fr_220px] gap-6">
          <div className="space-y-4">
            <Input label="Title" value={draft.title} onChange={(e: ChangeEvent<HTMLInputElement>) => set({ title: e.target.value })} placeholder="My wonderful book" />
            <Input label="Author" value={draft.author} onChange={(e: ChangeEvent<HTMLInputElement>) => set({ author: e.target.value })} placeholder="Jane Doe" />
            <Input label="Language (optional)" value={draft.language} onChange={(e: ChangeEvent<HTMLInputElement>) => set({ language: e.target.value })} placeholder="en" />
            <div>
              <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Cover</span>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} className="inline-flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4" /> Upload cover art
                </Button>
                {draft.coverImageDataUrl && (
                  <Button variant="ghost" size="sm" onClick={() => set({ coverImageDataUrl: null, coverImageMime: null })} className="inline-flex items-center gap-1.5">
                    <X className="w-4 h-4" /> Remove art
                  </Button>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { onCoverFile(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              {!draft.coverImageDataUrl && (
                <div className="mt-3">
                  <span className="block text-xs text-zinc-500 mb-2">…or pick a gradient cover (title is rendered on it):</span>
                  <div className="flex flex-wrap gap-2">
                    {GRADIENTS.map((g) => (
                      <button key={g.name} type="button" title={g.name}
                        onClick={() => set({ gradientFrom: g.from, gradientTo: g.to })}
                        className={cn("w-10 h-10 rounded-lg border-2 transition",
                          draft.gradientFrom === g.from ? "border-violet-500 scale-110" : "border-transparent")}
                        style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Live cover preview */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-zinc-500">Cover preview</span>
            <div className="w-40 aspect-[2/3] rounded-md overflow-hidden shadow-lg flex flex-col items-center justify-center text-center p-3"
              style={draft.coverImageDataUrl
                ? undefined
                : { background: `linear-gradient(160deg, ${draft.gradientFrom}, ${draft.gradientTo})` }}>
              {draft.coverImageDataUrl ? (
                <img src={draft.coverImageDataUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <>
                  <span className="font-bold text-white text-sm leading-snug">{draft.title || "Your title"}</span>
                  {draft.author && <span className="text-white/80 text-xs mt-2">{draft.author}</span>}
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Chapters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Chapters</h2>
          <Button size="sm" onClick={addChapter} className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add chapter
          </Button>
        </div>

        {draft.chapters.length === 0 && (
          <Card className="p-8 text-center text-zinc-500">
            <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No chapters yet. Add your first chapter, then fill it with text and pictures — anything you like.</p>
          </Card>
        )}

        {draft.chapters.map((ch, ci) => (
          <Card key={ch.id} className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Input value={ch.title} onChange={(e: ChangeEvent<HTMLInputElement>) => updateChapter(ch.id, { title: e.target.value })}
                placeholder={`Chapter ${ci + 1}`} className="font-semibold" />
              <Button variant="ghost" size="icon" title="Move up" onClick={() => moveChapter(ch.id, -1)} disabled={ci === 0}>
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Move down" onClick={() => moveChapter(ch.id, 1)} disabled={ci === draft.chapters.length - 1}>
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Delete chapter" onClick={() => deleteChapter(ch.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>

            <div className="space-y-3">
              {ch.blocks.map((b) => (
                <div key={b.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-1 mb-2 justify-end">
                    <Button variant="ghost" size="icon" title="Move up" onClick={() => moveBlock(ch.id, b.id, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Move down" onClick={() => moveBlock(ch.id, b.id, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Remove" onClick={() => deleteBlock(ch.id, b.id)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {b.kind === "text" ? (
                    <textarea
                      value={b.text}
                      onChange={(e) => updateBlock(ch.id, b.id, { text: e.target.value })}
                      placeholder="Type or paste your text here. Blank lines make new paragraphs."
                      rows={Math.min(10, Math.max(3, b.text.split("\n").length))}
                      className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  ) : (
                    <div>
                      <img src={b.dataUrl} alt="" className="max-h-48 rounded-md mx-auto" />
                      <Input label="Caption (optional)" value={b.caption} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBlock(ch.id, b.id, { caption: e.target.value })}
                        placeholder="A caption for this picture" />
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => addTextBlock(ch.id)} className="inline-flex items-center gap-1.5">
                  <Type className="w-4 h-4" /> Add text
                </Button>
                <Button variant="outline" size="sm" onClick={() => blockImgRefs.current[ch.id]?.click()} className="inline-flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4" /> Add picture
                </Button>
                <input ref={(el) => { blockImgRefs.current[ch.id] = el; }} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageBlock(ch.id, f); e.target.value = ""; }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Export */}
      <Card className="p-6 sticky bottom-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block w-2 h-2 rounded-full", savedAt ? "bg-green-500" : "bg-zinc-400")} />
              {savedAt ? `Draft saved ✓ ${savedAt.toLocaleTimeString()}` : "Draft will save as you type"}
            </span>
            {result && <span className="block mt-1 text-green-600 dark:text-green-400">
              Last export: {result.filename} ({formatBytes(result.size)})
            </span>}
          </div>
          <Button onClick={() => exportBook("epub")} disabled={busy !== null || draft.chapters.length === 0}
            className="inline-flex items-center gap-2">
            {busy === "epub" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download EPUB
          </Button>
          <Button variant="secondary" onClick={() => exportBook("pdf")} disabled={busy !== null || draft.chapters.length === 0}
            className="inline-flex items-center gap-2">
            {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Download PDF
          </Button>
        </div>
      </Card>
    </div>
  );
}
