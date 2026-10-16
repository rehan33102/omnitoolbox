"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown, ArrowUp, BookOpen, Download, Eye, EyeOff, FileDown, ImagePlus,
  Loader2, Palette, Plus, Trash2, Type, X, RotateCcw, LayoutTemplate, AlertTriangle,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn, formatBytes } from "@/lib/utils";
import {
  buildEpub, buildPdf,
  EBOOK_THEMES, COVER_TEMPLATES, scopedThemeCss,
  type BookData, type EbookBlock, type EbookChapter, type CoverTemplate,
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
  themeId: string;
  coverImageDataUrl: string | null;
  coverImageMime: "image/jpeg" | "image/png" | null;
  coverTemplate: CoverTemplate;
  gradientFrom: string;
  gradientTo: string;
  chapters: DraftChapter[];
}

const DRAFT_KEY = "ebook-maker-draft-v2";
const OLD_DRAFT_KEY = "ebook-maker-draft-v1";
const MAX_IMG_DIM = 1600; // longest side, per the export contract

const GRADIENTS: { name: string; from: string; to: string }[] = [
  { name: "Midnight", from: "#312e81", to: "#0f172a" },
  { name: "Sunset", from: "#c2410c", to: "#7c2d12" },
  { name: "Ocean", from: "#0e7490", to: "#164e63" },
  { name: "Forest", from: "#15803d", to: "#052e16" },
  { name: "Rose", from: "#be123c", to: "#4c0519" },
  { name: "Violet", from: "#7c3aed", to: "#2e1065" },
  { name: "Crimson", from: "#991b1b", to: "#1c0a0a" },
  { name: "Teal", from: "#0f766e", to: "#042f2e" },
  { name: "Slate", from: "#475569", to: "#0b1220" },
  { name: "Amber", from: "#b45309", to: "#451a03" },
];

function nid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function blankDraft(): Draft {
  return {
    title: "", author: "", language: "en",
    themeId: "classic",
    coverImageDataUrl: null, coverImageMime: null,
    coverTemplate: "centered",
    gradientFrom: GRADIENTS[0].from, gradientTo: GRADIENTS[0].to,
    chapters: [],
  };
}

function loadDraft(): Draft {
  try {
    for (const key of [DRAFT_KEY, OLD_DRAFT_KEY]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.chapters)) continue;
      return { ...blankDraft(), ...d };
    }
  } catch { /* corrupted draft */ }
  return blankDraft();
}

/* ------------------------------------------------------------------ */
/* Image pipeline — the durable fix for "Export failed".               */
/*                                                                     */
/* 1. Every added image is downscaled (≤1600px) + compressed to JPEG   */
/*    unless it has real transparency (then PNG).                      */
/* 2. At export, every stored image is re-normalized the same way, so  */
/*    even old/oversized drafts export cleanly.                        */
/* 3. data URLs are decoded DIRECTLY (atob) — never via fetch(), which */
/*    is the fragile path that failed on phones with multi-MB images.  */
/* ------------------------------------------------------------------ */

/** Decode a data URL to raw bytes without fetch(). Throws on bad input. */
function dataUrlToBytes(dataUrl: string): ArrayBuffer {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Image data is not a valid data URL");
  const b64 = dataUrl.slice(comma + 1).trim();
  if (!b64) throw new Error("Image data is empty");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

function dataUrlMime(dataUrl: string): string {
  const m = dataUrl.slice(0, dataUrl.indexOf(",")).match(/data:([^;]+)/);
  return m ? m[1] : "image/jpeg";
}

/** Does this RGBA pixel buffer contain any real transparency? (sampled) */
function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4 * 24) {
    if (data[i] < 250) return true;
  }
  return false;
}

async function bitmapToDataUrl(bitmap: ImageBitmap, keepPng: boolean): Promise<{ dataUrl: string; mime: "image/jpeg" | "image/png" }> {
  const scale = Math.min(1, MAX_IMG_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: keepPng })!;
  g.drawImage(bitmap, 0, 0, w, h);
  let usePng = false;
  if (keepPng) {
    try {
      const px = g.getImageData(0, 0, w, h).data;
      usePng = hasTransparency(px);
    } catch { usePng = true; }
  }
  const mime = usePng ? "image/png" : "image/jpeg";
  const dataUrl = usePng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  return { dataUrl, mime };
}

/** Normalize an uploaded File → small JPEG/PNG data URL. */
async function normalizeImage(file: File): Promise<{ dataUrl: string; mime: "image/jpeg" | "image/png" }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Could not read "${file.name || "that image"}" — try a JPG or PNG.`);
  }
  try {
    return await bitmapToDataUrl(bitmap, file.type === "image/png");
  } finally {
    bitmap.close();
  }
}

/** Re-normalize a stored data URL (used at export for old/oversized drafts). */
async function shrinkDataUrl(dataUrl: string): Promise<{ dataUrl: string; mime: "image/jpeg" | "image/png" }> {
  const bytes = dataUrlToBytes(dataUrl);
  const origMime = dataUrlMime(dataUrl);
  const blob = new Blob([bytes], { type: origMime });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("An image in your book could not be decoded.");
  }
  try {
    return await bitmapToDataUrl(bitmap, origMime === "image/png");
  } finally {
    bitmap.close();
  }
}

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.length > 180 ? m.slice(0, 180) + "…" : (m || "Unknown error");
}

function chapterWords(ch: DraftChapter): number {
  let w = 0;
  for (const b of ch.blocks) if (b.kind === "text") w += b.text.split(/\s+/).filter(Boolean).length;
  return w;
}

/* ------------------------------------------------------------------ */
/* Cover preview (shared by the designer + live preview)               */
/* ------------------------------------------------------------------ */

function CoverPreview({ draft, className }: { draft: Draft; className?: string }) {
  const t = draft.coverTemplate;
  const grad = `linear-gradient(160deg, ${draft.gradientFrom}, ${draft.gradientTo})`;
  const title = draft.title || "Your title";
  const author = draft.author || "";
  return (
    <div className={cn("rounded-md overflow-hidden shadow-lg flex flex-col", className)}
      style={draft.coverImageDataUrl ? undefined : { background: grad }}>
      {draft.coverImageDataUrl ? (
        <img src={draft.coverImageDataUrl} alt="Cover" className="w-full h-full object-cover" />
      ) : t === "top-band" ? (
        <>
          <div className="flex items-center justify-center p-4 text-center" style={{ minHeight: "34%" }}>
            <span className="font-bold text-white text-sm leading-snug">{title}</span>
          </div>
          {author && <span className="text-center text-zinc-600 dark:text-zinc-400 text-xs mt-3 px-3">{author}</span>}
        </>
      ) : t === "minimal" ? (
        <div className="flex-1 flex flex-col justify-end p-4">
          <div className="w-8 border-t-[3px] mb-2" style={{ borderColor: draft.gradientFrom }} />
          <span className="text-zinc-800 dark:text-zinc-100 text-sm leading-snug">{title}</span>
          {author && <span className="text-zinc-500 text-xs mt-1.5">{author}</span>}
        </div>
      ) : t === "bold" ? (
        <div className="flex-1 flex flex-col justify-end p-4">
          <span className="font-extrabold text-white text-lg leading-tight">{title}</span>
          {author && <span className="text-white/80 text-[11px] mt-2 uppercase tracking-[0.2em]">{author}</span>}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <span className="font-bold text-white text-sm leading-snug">{title}</span>
          {author && <span className="text-white/80 text-xs mt-2">{author}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function EbookMaker() {
  const [draft, setDraft] = useState<Draft | null>(null); // null until hydrated
  const [busy, setBusy] = useState<null | "epub" | "pdf">(null);
  const [result, setResult] = useState<{ url: string; filename: string; size: number; kind: "epub" | "pdf" } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const blockImgRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  // Hydrate draft (client-only) + autosave
  useEffect(() => {
    const d = loadDraft();
    setDraft(d);
    setActiveId(d.chapters[0]?.id ?? null);
  }, []);
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedAt(new Date());
      } catch { /* quota — indicator stays honest */ }
    }, 500);
    return () => clearTimeout(t);
  }, [draft]);

  const stats = useMemo(() => {
    if (!draft) return { chapters: 0, words: 0, images: 0, imgBytes: 0 };
    let words = 0, images = 0, imgBytes = 0;
    for (const c of draft.chapters) {
      for (const b of c.blocks) {
        if (b.kind === "text") words += b.text.split(/\s+/).filter(Boolean).length;
        else { images += 1; imgBytes += Math.ceil((b.dataUrl.length * 3) / 4); }
      }
    }
    if (draft.coverImageDataUrl) { images += 1; imgBytes += Math.ceil((draft.coverImageDataUrl.length * 3) / 4); }
    return { chapters: draft.chapters.length, words, images, imgBytes };
  }, [draft]);

  const estPages = Math.max(stats.chapters, Math.ceil(stats.words / 280) + Math.ceil(stats.images / 3));
  const readMins = Math.max(1, Math.round(stats.words / 200));
  const active = draft?.chapters.find((c) => c.id === activeId) ?? draft?.chapters[0] ?? null;
  const theme = EBOOK_THEMES.find((t) => t.id === draft?.themeId) ?? EBOOK_THEMES[0];
  const previewCss = useMemo(() => scopedThemeCss(theme.css, ".ebook-preview"), [theme]);

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
    } catch (e) {
      toast({ title: "Couldn't add that image", variant: "error", description: errMsg(e) });
    }
  };

  const addChapter = () =>
    setDraft((d) => {
      if (!d) return d;
      const ch = { id: nid(), title: `Chapter ${d.chapters.length + 1}`, blocks: [] as DraftBlock[] };
      setActiveId(ch.id);
      return { ...d, chapters: [...d.chapters, ch] };
    });

  const deleteChapter = (id: string) =>
    setDraft((d) => {
      if (!d) return d;
      const chs = d.chapters.filter((c) => c.id !== id);
      if (activeId === id) setActiveId(chs[0]?.id ?? null);
      return { ...d, chapters: chs };
    });

  const resetAll = () => {
    if (!window.confirm("Start a new book? This clears your current draft.")) return;
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(OLD_DRAFT_KEY);
    const d = blankDraft();
    setDraft(d);
    setActiveId(null);
    setSavedAt(null);
    setResult(null);
  };

  const onCoverFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { dataUrl, mime } = await normalizeImage(file);
      set({ coverImageDataUrl: dataUrl, coverImageMime: mime });
    } catch (e) {
      toast({ title: "Couldn't add that cover", variant: "error", description: errMsg(e) });
    }
  };

  /** Convert the UI draft into pure BookData — re-normalizing every stored
   *  image so even old/oversized drafts export cleanly. Images that still
   *  can't be decoded are skipped (never fatal) and reported. */
  const toBookData = async (): Promise<{ book: BookData; warnings: string[] }> => {
    const warnings: string[] = [];
    const chapters: EbookChapter[] = [];
    for (const c of draft.chapters) {
      const blocks: EbookBlock[] = [];
      for (const b of c.blocks) {
        if (b.kind === "text") {
          if (b.text.trim()) blocks.push({ kind: "text", text: b.text.trim() });
        } else {
          try {
            const { dataUrl, mime } = await shrinkDataUrl(b.dataUrl);
            blocks.push({
              kind: "image",
              imageData: dataUrlToBytes(dataUrl),
              mimeType: mime,
              caption: b.caption?.trim() || undefined,
            });
          } catch (e) {
            warnings.push(`A picture in "${c.title || "a chapter"}" couldn't be read and was skipped (${errMsg(e)})`);
          }
        }
      }
      chapters.push({ id: c.id, title: c.title.trim() || "Untitled chapter", blocks });
    }
    let coverImageData: ArrayBuffer | undefined;
    let coverImageMime: "image/jpeg" | "image/png" | "image/webp" | undefined;
    if (draft.coverImageDataUrl) {
      try {
        const { dataUrl, mime } = await shrinkDataUrl(draft.coverImageDataUrl);
        coverImageData = dataUrlToBytes(dataUrl);
        coverImageMime = mime;
      } catch (e) {
        warnings.push(`Cover photo couldn't be read and was skipped (${errMsg(e)})`);
      }
    }
    return {
      book: {
        title: draft.title.trim() || "Untitled",
        author: draft.author.trim(),
        language: draft.language.trim() || "en",
        themeId: draft.themeId,
        cover: {
          imageData: coverImageData,
          imageMime: coverImageMime,
          gradientFrom: draft.gradientFrom,
          gradientTo: draft.gradientTo,
          template: draft.coverTemplate,
        },
        chapters,
      },
      warnings,
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
      const { book, warnings: preWarnings } = await toBookData();
      const showDone = (size: number, warnings: string[]) => {
        const all = [...preWarnings, ...warnings];
        toast({
          title: kind === "epub" ? "EPUB downloaded" : "PDF downloaded",
          variant: "success",
          description: all.length
            ? `${formatBytes(size)} — ${all.length} image(s) skipped`
            : formatBytes(size),
        });
      };
      if (kind === "epub") {
        const { blob, filename, warnings } = await buildEpub(book);
        downloadBlob(blob, filename, "epub");
        showDone(blob.size, warnings);
      } else {
        const { blob, filename, warnings } = await buildPdf(book);
        downloadBlob(blob, filename, "pdf");
        showDone(blob.size, warnings);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Export failed", variant: "error", description: errMsg(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Stats + actions */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {stats.chapters} chapters</span>
          <span>{stats.words.toLocaleString()} words</span>
          <span>{stats.images} images</span>
          {stats.words > 0 && <span className="hidden sm:inline">≈{estPages} pages · {readMins} min read</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={resetAll} className="inline-flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4" /> Start new book
        </Button>
      </div>

      {/* Interior theme */}
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-1 inline-flex items-center gap-2"><Palette className="w-5 h-5" /> Page theme</h2>
        <p className="text-sm text-zinc-500 mb-4">Applies to the live preview, the EPUB and the PDF.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {EBOOK_THEMES.map((t) => (
            <button key={t.id} type="button" onClick={() => set({ themeId: t.id })}
              className={cn("rounded-xl border-2 p-4 text-left transition",
                draft.themeId === t.id
                  ? "border-violet-500 bg-violet-500/5"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}>
              <span className={cn("block font-bold text-sm mb-1",
                t.id === "classic" && "font-serif",
                t.id === "dark" && "text-amber-200",
                t.id === "minimal" && "font-light")}>{t.name}</span>
              <span className="block text-xs text-zinc-500 leading-snug">{t.tagline}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Book details + cover designer */}
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4 inline-flex items-center gap-2"><LayoutTemplate className="w-5 h-5" /> Book & cover design</h2>
        <div className="grid md:grid-cols-[1fr_240px] gap-6">
          <div className="space-y-4">
            <Input label="Title" value={draft.title} onChange={(e: ChangeEvent<HTMLInputElement>) => set({ title: e.target.value })} placeholder="My wonderful book" />
            <Input label="Author" value={draft.author} onChange={(e: ChangeEvent<HTMLInputElement>) => set({ author: e.target.value })} placeholder="Jane Doe" />
            <Input label="Language (optional)" value={draft.language} onChange={(e: ChangeEvent<HTMLInputElement>) => set({ language: e.target.value })} placeholder="en" />
            <div>
              <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Cover style</span>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {COVER_TEMPLATES.map((ct) => (
                  <button key={ct.id} type="button" title={ct.tagline}
                    onClick={() => set({ coverTemplate: ct.id })}
                    className={cn("rounded-lg border-2 px-3 py-2 text-left transition",
                      draft.coverTemplate === ct.id
                        ? "border-violet-500 bg-violet-500/5"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}>
                    <span className="block text-sm font-semibold">{ct.name}</span>
                    <span className="block text-[11px] text-zinc-500">{ct.tagline}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} className="inline-flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4" /> Upload photo cover
                </Button>
                {draft.coverImageDataUrl && (
                  <Button variant="ghost" size="sm" onClick={() => set({ coverImageDataUrl: null, coverImageMime: null })} className="inline-flex items-center gap-1.5">
                    <X className="w-4 h-4" /> Remove photo
                  </Button>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { onCoverFile(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              {!draft.coverImageDataUrl && (
                <div className="mt-3">
                  <span className="block text-xs text-zinc-500 mb-2">Cover colors:</span>
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
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-zinc-500">Live cover</span>
            <CoverPreview draft={draft} className="w-44 aspect-[2/3]" />
          </div>
        </div>
      </Card>

      {/* Editor zone: chapters rail | editor | preview */}
      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)_320px] gap-4 items-start">
        {/* Chapters rail */}
        <Card className="p-3 lg:sticky lg:top-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-sm font-bold">Chapters</span>
            <Button size="sm" variant="ghost" onClick={addChapter} className="inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
          {draft.chapters.length === 0 && (
            <p className="text-xs text-zinc-500 px-1 py-2">No chapters yet — add your first one.</p>
          )}
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-1">
            {draft.chapters.map((ch, i) => {
              const w = chapterWords(ch);
              const imgs = ch.blocks.filter((b) => b.kind === "image").length;
              return (
                <button key={ch.id} type="button" onClick={() => setActiveId(ch.id)}
                  className={cn("shrink-0 lg:w-full text-left rounded-lg border px-3 py-2 transition",
                    active?.id === ch.id
                      ? "border-violet-500 bg-violet-500/5"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}>
                  <span className="block text-sm font-semibold truncate">{ch.title || `Chapter ${i + 1}`}</span>
                  <span className="block text-[11px] text-zinc-500">{w.toLocaleString()} words{imgs > 0 ? ` · ${imgs} img` : ""}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Editor */}
        <div>
          {!active ? (
            <Card className="p-10 text-center text-zinc-500">
              <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Add a chapter to start writing — text and pictures, anything you like.</p>
              <Button size="sm" onClick={addChapter} className="mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add chapter
              </Button>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Input value={active.title} onChange={(e: ChangeEvent<HTMLInputElement>) => updateChapter(active.id, { title: e.target.value })}
                  placeholder="Chapter title" className="font-semibold" />
                <Button variant="ghost" size="icon" title="Move chapter up"
                  onClick={() => moveChapter(active.id, -1)}
                  disabled={draft.chapters.findIndex((c) => c.id === active.id) === 0}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Move chapter down"
                  onClick={() => moveChapter(active.id, 1)}
                  disabled={draft.chapters.findIndex((c) => c.id === active.id) === draft.chapters.length - 1}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Delete chapter" onClick={() => deleteChapter(active.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
                <Button variant="ghost" size="icon" title={showPreview ? "Hide preview" : "Show preview"}
                  onClick={() => setShowPreview((s) => !s)} className="lg:hidden">
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>

              <div className="space-y-3">
                {active.blocks.map((b) => (
                  <div key={b.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-1 mb-2 justify-end">
                      <Button variant="ghost" size="icon" title="Move up" onClick={() => moveBlock(active.id, b.id, -1)}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Move down" onClick={() => moveBlock(active.id, b.id, 1)}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Remove" onClick={() => deleteBlock(active.id, b.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {b.kind === "text" ? (
                      <textarea
                        value={b.text}
                        onChange={(e) => updateBlock(active.id, b.id, { text: e.target.value })}
                        placeholder="Type or paste your text here. Blank lines make new paragraphs."
                        rows={Math.min(12, Math.max(4, b.text.split("\n").length))}
                        className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    ) : (
                      <div>
                        <img src={b.dataUrl} alt="" className="max-h-48 rounded-md mx-auto" />
                        <Input label="Caption (optional)" value={b.caption} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBlock(active.id, b.id, { caption: e.target.value })}
                          placeholder="A caption for this picture" />
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => addTextBlock(active.id)} className="inline-flex items-center gap-1.5">
                    <Type className="w-4 h-4" /> Add text
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => blockImgRefs.current[active.id]?.click()} className="inline-flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4" /> Add picture
                  </Button>
                  <input ref={(el) => { blockImgRefs.current[active.id] = el; }} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageBlock(active.id, f); e.target.value = ""; }} />
                </div>
              </div>

              {/* Mobile preview (toggle) */}
              {showPreview && (
                <div className="lg:hidden mt-6">
                  <ChapterPreview draft={draft} chapter={active} themeCss={previewCss} />
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Desktop preview */}
        <div className="hidden lg:block sticky top-4">
          {active && <ChapterPreview draft={draft} chapter={active} themeCss={previewCss} />}
        </div>
      </div>

      {/* Export */}
      <Card className="p-6 sticky bottom-4 shadow-xl">
        {stats.imgBytes > 4 * 1024 * 1024 && (
          <div className="mb-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Images total {formatBytes(stats.imgBytes)} — they’ll be auto-compressed on export.</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block w-2 h-2 rounded-full", savedAt ? "bg-green-500" : "bg-zinc-400")} />
              {savedAt ? `Draft saved ✓ ${savedAt.toLocaleTimeString()}` : "Draft will save as you type"}
            </span>
            {stats.words > 0 && (
              <span className="block mt-1">≈{estPages} pages · {readMins} min read · {theme.name}</span>
            )}
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

/* ------------------------------------------------------------------ */
/* Live chapter preview — renders exactly with the selected theme      */
/* ------------------------------------------------------------------ */

function ChapterPreview({ draft, chapter, themeCss }: { draft: Draft; chapter: DraftChapter; themeCss: string }) {
  const theme = EBOOK_THEMES.find((t) => t.id === draft.themeId) ?? EBOOK_THEMES[0];
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 inline-flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Page preview
        </span>
        <span className="text-[11px] text-zinc-500">{theme.name}</span>
      </div>
      <style>{themeCss}</style>
      <div className="ebook-preview px-6 py-8 min-h-[420px]">
        <CoverPreview draft={draft} className="w-24 aspect-[2/3] mx-auto mb-6" />
        <h1 className="chapter-title">{chapter.title || "Untitled chapter"}</h1>
        {theme.id === "modern" && <div className="chapter-kicker">Chapter preview</div>}
        {theme.id === "minimal" && <hr className="chapter-rule" />}
        <div className="chapter-body">
          {chapter.blocks.length === 0 && (
            <p className="text-sm opacity-60">Nothing here yet — add text or pictures in the editor.</p>
          )}
          {chapter.blocks.map((b) =>
            b.kind === "text" ? (
              <PreviewText key={b.id} text={b.text} />
            ) : (
              <figure key={b.id}>
                <img src={b.dataUrl} alt={b.caption || ""} />
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewText({ text }: { text: string }) {
  const paras = text.split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return <p className="opacity-40 text-sm">Empty text block…</p>;
  return (
    <>
      {paras.map((p, i) => (
        <p key={i}>{p.split("\n").map((ln, j, arr) => (
          <span key={j}>{ln}{j < arr.length - 1 && <br />}</span>
        ))}</p>
      ))}
    </>
  );
}
