"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Languages, Loader2, Mic, Play, Square, Trash2, History, FileText, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { deleteBlob, getBlob, saveBlob } from "@/lib/db";
import { saveToLibrary } from "@/lib/library-save";
import { downloadBlob as downloadBlobFile } from "@/lib/download";
import { synthesizePiper, hasPiperVoice, type PiperProgress } from "@/lib/piper-tts-client";

const MAX_CHARS = 100000; // effectively unlimited — chunked server-side
const PART_CHARS = 500; // per server request; server chunks further internally
const HISTORY_KEY = "omnitoolbox-voiceover-history";
const HISTORY_LIMIT = 20;

// Microsoft Edge neural voices (free, no key) — primary engine.
const EDGE_LANGS_FALLBACK = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "ur", label: "Urdu", flag: "🇵🇰" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "fr", label: "French", flag: "🇫🇷" },
];
const EDGE_STYLES_FALLBACK = [
  { key: "sleep", label: " Sleep / Deep Calm" },
  { key: "calm", label: " Calm Story" },
  { key: "normal", label: " Normal" },
  { key: "energetic", label: " Energetic / YouTube" },
];

// Other languages fall back to the free Google voice.
const BASIC_LANGUAGES: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "pa", label: "Punjabi" },
  { code: "ps", label: "Pashto" },
  { code: "fa", label: "Persian" },
  { code: "bn", label: "Bengali" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "id", label: "Indonesian" },
  { code: "ms", label: "Malay" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
  { code: "el", label: "Greek" },
  { code: "he", label: "Hebrew" },
  { code: "sw", label: "Swahili" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
];

type HistoryItem = {
  id: string;
  text: string;
  lang: string;
  langLabel: string;
  voiceLabel?: string;
  createdAt: number;
  chars: number;
};

type ElevenVoice = { id: string; name: string; gender: string };
type EdgeLang = { code: string; label: string; flag: string };
type EdgeStyle = { key: string; label: string };
type SpeechCue = { start: number; end: number; text: string };

const DEFAULT_TEXT =
  "Hello, and welcome to the OmniToolBox A.I. Voiceover Studio. Type, or paste your script here... pick a language, then press Generate. You'll get real, studio-quality MP3 audio, that you can play, download, and reuse anywhere.";

/* Localized preview samples — one short line per on-device voice language. */
const PREVIEW_SAMPLES: Record<string, string> = {
  en: "Hello! This is a preview of the selected voice.",
  es: "¡Hola! Esta es una vista previa de la voz seleccionada.",
  ur: "السلام علیکم! یہ منتخب آواز کا پیش نظارہ ہے۔",
  de: "Hallo! Dies ist eine Vorschau der ausgewählten Stimme.",
  ja: "こんにちは！選択した音声のプレビューです。",
  fr: "Bonjour ! Ceci est un aperçu de la voix sélectionnée.",
  ru: "Привет! Это предварительный просмотр выбранного голоса.",
  it: "Ciao! Questa è un'anteprima della voce selezionata.",
  pl: "Cześć! To jest podgląd wybranego głosu.",
  nl: "Hallo! Dit is een voorbeeld van de geselecteerde stem.",
  ar: "مرحباً! هذه معاينة للصوت المحدد.",
  pt: "Olá! Esta é uma prévia da voz selecionada.",
  zh: "你好！这是所选声音的预览。",
  tr: "Merhaba! Bu, seçilen sesin bir önizlemesidir.",
  fa: "سلام! این پیش‌نمایش صدای انتخاب شده است.",
  vi: "Xin chào! Đây là bản xem trước của giọng nói đã chọn.",
  sv: "Hej! Det här är en förhandsvisning av den valda rösten.",
  da: "Hej! Dette er en forhåndsvisning af den valgte stemme.",
  fi: "Hei! Tämä on esikatselu valitusta äänestä.",
  no: "Hei! Dette er en forhåndsvisning av den valgte stemmen.",
  el: "Γεια σας! Αυτή είναι μια προεπισκόπηση της επιλεγμένης φωνής.",
  ro: "Bună! Aceasta este o previzualizare a vocii selectate.",
  uk: "Привіт! Це попередній перегляд вибраного голосу.",
  cs: "Ahoj! Toto je náhled vybraného hlasu.",
};

type TtsEngine = "edge" | "elevenlabs" | "google" | "google-fallback" | "piper" | "";

/** Split long scripts into sentence-aware parts for sequential server requests. */
function chunkText(text: string, maxLen = PART_CHARS): string[] {
  const sentences = text.match(/[^.!?;\n]+[.!?;\n]+["'”]?|\S[^.!?;\n]*$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const t = s.trim();
    if (!t) continue;
    if (current && `${current} ${t}`.length > maxLen) {
      chunks.push(current);
      current = t;
    } else {
      current = current ? `${current} ${t}` : t;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

function downloadBlob(blob: Blob, filename: string) {
  downloadBlobFile(blob, filename);
}

const FORM_KEY = "omnitoolbox-voiceover-form";

interface SavedForm {
  lang: string; text: string; edgeVoice: "male" | "female"; edgeStyle: string;
  ratePct: number; pitchHz: number; useCustomRate: boolean; useCustomPitch: boolean;
  pauseSec: number; useCustomPause: boolean;
}

function loadSavedForm(): Partial<SavedForm> {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export default function VoiceoverStudio() {
  const [savedForm] = useState<SavedForm | null>(() => {
    if (typeof window === "undefined") return null;
    const s = loadSavedForm();
    return {
      lang: s.lang ?? "en",
      text: s.text ?? DEFAULT_TEXT,
      edgeVoice: s.edgeVoice ?? "female",
      edgeStyle: s.edgeStyle ?? "sleep",
      ratePct: s.ratePct ?? 0,
      pitchHz: s.pitchHz ?? -4,
      useCustomRate: s.useCustomRate ?? false,
      useCustomPitch: s.useCustomPitch ?? true,
      pauseSec: s.pauseSec ?? 0.4,
      useCustomPause: s.useCustomPause ?? true,
    };
  });
  const [lang, setLang] = useState(savedForm?.lang ?? "en");
  const [text, setText] = useState(savedForm?.text ?? DEFAULT_TEXT);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  // Premium (ElevenLabs) controls — only shown when the server has a key.
  // Edge neural voice controls (free, primary engine).
  const [edgeLangs, setEdgeLangs] = useState<EdgeLang[]>(EDGE_LANGS_FALLBACK);
  const [edgeStyles, setEdgeStyles] = useState<EdgeStyle[]>(EDGE_STYLES_FALLBACK);
  const [edgeVoice, setEdgeVoice] = useState<"male" | "female">(savedForm?.edgeVoice ?? "female");
  const [edgeStyle, setEdgeStyle] = useState(savedForm?.edgeStyle ?? "sleep");
  const [ratePct, setRatePct] = useState(savedForm?.ratePct ?? 0);   // speed override, -40..40 (0 = style default)
  const [pitchHz, setPitchHz] = useState(savedForm?.pitchHz ?? -4);   // pitch override, -15..15 (default -4)
  const [useCustomRate, setUseCustomRate] = useState(savedForm?.useCustomRate ?? false);
  const [useCustomPitch, setUseCustomPitch] = useState(savedForm?.useCustomPitch ?? true);
  const [pauseSec, setPauseSec] = useState(savedForm?.pauseSec ?? 0.4);
  const [useCustomPause, setUseCustomPause] = useState(savedForm?.useCustomPause ?? true);
  const [engine, setEngine] = useState<TtsEngine>("");
  const [previewing, setPreviewing] = useState(false);
  const [previewStep, setPreviewStep] = useState("");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Persist form state — script and settings survive navigation/refresh
  useEffect(() => {
    try {
      const data: SavedForm = {
        lang, text, edgeVoice, edgeStyle,
        ratePct, pitchHz, useCustomRate, useCustomPitch,
        pauseSec, useCustomPause,
      };
      localStorage.setItem(FORM_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }, [lang, text, edgeVoice, edgeStyle, ratePct, pitchHz, useCustomRate, useCustomPitch, pauseSec, useCustomPause]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef(false);
  const { toast } = useToast();

  const isEdgeLang = edgeLangs.some((l) => l.code === lang);
  const showEdgeControls = isEdgeLang;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* ignore */
    }
    fetch("/api/voiceover/config")
      .then((r) => r.json())
      .then((c: { edge?: { languages?: EdgeLang[]; styles?: EdgeStyle[] } }) => {
        if (c.edge?.languages?.length) setEdgeLangs(c.edge.languages);
        if (c.edge?.styles?.length) setEdgeStyles(c.edge.styles);
      })
      .catch(() => {});
  }, []);

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  };

  const langLabel = (code: string) =>
    edgeLangs.find((l) => l.code === code)?.label ??
    BASIC_LANGUAGES.find((l) => l.code === code)?.label ?? code;

  /** Preview the selected voice with a short localized sample — not saved to history. */
  const previewVoice = useCallback(async () => {
    if (previewing) {
      previewAudioRef.current?.pause();
      setPreviewing(false);
      setPreviewStep("");
      return;
    }
    setPreviewing(true);
    setPreviewStep("");
    const sampleText = PREVIEW_SAMPLES[lang] ?? PREVIEW_SAMPLES.en;
    const playBlob = async (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const el = previewAudioRef.current;
      if (!el) throw new Error("no audio element");
      el.src = url;
      el.onended = () => {
        setPreviewing(false);
        setPreviewStep("");
        URL.revokeObjectURL(url);
      };
      await el.play();
    };
    const piperProgress = (p: PiperProgress) => {
      const pct = Math.round(p.fraction * 100);
      setPreviewStep(
        p.stage === "download"
          ? `Downloading voice model… ${pct}% (first time only)`
          : p.stage === "encode"
            ? `Encoding… ${pct}%`
            : `Generating… ${pct}%`,
      );
    };
    // Attempt 1: OUR OWN on-device Piper TTS — real male/female, no server involved.
    if (hasPiperVoice(lang)) {
      try {
        const { blob } = await synthesizePiper(sampleText, lang, edgeVoice, piperProgress);
        setPreviewStep("");
        await playBlob(blob);
        return;
      } catch (e) {
        setPreviewing(false);
        setPreviewStep("");
        toast({ title: "Preview failed", variant: "error", description: e instanceof Error ? e.message : "Try again in a moment." });
        return;
      }
    }
    // No on-device voice for this language. Never serve the server's
    // female-sounding fallback as "Male" — say so clearly instead.
    if (edgeVoice === "male") {
      setPreviewing(false);
      toast({
        title: "No male voice for this language yet",
        variant: "error",
        description: "On-device male voices are ready for English, German, French, Russian, Italian, Polish and Dutch. Pick Female for a basic voice, or switch language.",
      });
      return;
    }
    // Attempt 2: server basic voice (female only) — the UI labels it honestly.
    try {
      const res = await fetch("/api/voiceover/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sampleText,
          lang,
          voice: edgeVoice,
          style: edgeStyle,
        }),
      });
      if (!res.ok) throw new Error("preview failed");
      const url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "audio/mpeg" }));
      const el = previewAudioRef.current;
      if (!el) throw new Error("no audio element");
      el.src = url;
      el.onended = () => {
        setPreviewing(false);
        URL.revokeObjectURL(url);
      };
      await el.play();
    } catch {
      setPreviewing(false);
      toast({ title: "Preview failed", variant: "error", description: "Try again in a moment." });
    }
  }, [lang, edgeVoice, edgeStyle, previewing, toast]);

  const generate = useCallback(async () => {
    const script = text.trim();
    if (!script) {
      toast({ title: "Nothing to speak", variant: "error", description: "Type or paste your script first." });
      return;
    }
    if (script.length > MAX_CHARS) {
      toast({ title: "Text too long", variant: "error", description: `Keep it under ${MAX_CHARS.toLocaleString()} characters.` });
      return;
    }
    stopRef.current = false;
    setGenerating(true);
    setGenStep("");
    try {
      const parts = chunkText(script);
      const partData: { text: string; blob: Blob; cues: SpeechCue[] }[] = [];
      const usePiper = hasPiperVoice(lang);
      // No on-device voice + Male selected: never serve the server's
      // female-sounding fallback as "Male" — fail loudly instead.
      if (!usePiper && edgeVoice === "male") {
        throw new Error(
          "No on-device male voice for this language yet. English, German, French, Russian, Italian, Polish and Dutch have real male voices — or pick Female for a basic voice.",
        );
      }
      for (let i = 0; i < parts.length; i++) {
        if (stopRef.current) return;
        setGenStep(parts.length > 1 ? `Generating part ${i + 1} of ${parts.length}…` : "Generating voice…");
        let blob: Blob | null = null;
        let cues: SpeechCue[] = [];
        let usedEngine: TtsEngine = "";
        // Attempt 1: OUR OWN on-device Piper TTS — real male/female, no server.
        if (usePiper) {
          const partLabel = parts.length > 1 ? ` (part ${i + 1}/${parts.length})` : "";
          const { blob: piperBlob } = await synthesizePiper(parts[i], lang, edgeVoice, (p) => {
            if (stopRef.current) return;
            const pct = Math.round(p.fraction * 100);
            const stageLabel =
              p.stage === "download"
                ? "Downloading voice model (first time only)"
                : p.stage === "encode"
                  ? "Encoding MP3"
                  : "Generating voice";
            setGenStep(`${stageLabel}… ${pct}%${partLabel}`);
          });
          blob = piperBlob;
          usedEngine = "piper";
        }
        // Attempt 2: server API (last resort — female only; male is rejected above).
        if (!blob) {
          const payload: Record<string, unknown> = { text: parts[i], lang };
          if (edgeLangs.some((l) => l.code === lang)) {
            payload.voice = edgeVoice;
            payload.style = edgeStyle;
            if (useCustomRate) payload.ratePct = ratePct;
            if (useCustomPitch) payload.pitchHz = pitchHz;
            if (useCustomPause) payload.pauseSec = pauseSec;
          }
          const res = await fetch("/api/voiceover/synthesize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? "Generation failed");
          }
          const buf = await res.arrayBuffer();
          if (buf.byteLength < 500) throw new Error("Empty audio");
          blob = new Blob([buf], { type: "audio/mpeg" });
          if (i === 0) {
            const h = res.headers.get("X-TTS-Engine");
            usedEngine = h === "edge" || h === "elevenlabs" || h === "google" || h === "google-fallback" ? h : "google";
          }
          const cuesHeader = res.headers.get("X-Speech-Cues");
          if (cuesHeader) {
            try {
              const raw = atob(cuesHeader.replace(/-/g, "+").replace(/_/g, "/"));
              const json = decodeURIComponent(escape(raw));
              const parsed = JSON.parse(json) as SpeechCue[];
              if (Array.isArray(parsed)) cues = parsed;
            } catch {
              /* fall back to estimates */
            }
          }
        }
        if (i === 0 && usedEngine) {
          setEngine(usedEngine);
        }
        partData.push({ text: parts[i], blob, cues });
      }
      if (stopRef.current) return;
      const blob = new Blob(partData.map((p) => p.blob), { type: "audio/mpeg" });
      const fileName = `voiceover-${lang}-${new Date().toISOString().slice(0, 10)}.mp3`;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      const vLabel = edgeLangs.some((l) => l.code === lang)
        ? `${edgeVoice === "male" ? "Male" : "Female"} · ${edgeStyles.find((s) => s.key === edgeStyle)?.label ?? edgeStyle}`
        : undefined;
      // Persist the MP3 to the central library (kind "voiceover"), SRT in meta.
      const blobId = await saveToLibrary("voiceover", blob, fileName, {
        text: script.slice(0, 100) + (script.length > 100 ? "…" : ""),
        lang,
        langLabel: langLabel(lang),
        voiceLabel: vLabel ?? "",
        chars: script.length,
      });
      const id = blobId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: HistoryItem = {
        id,
        text: script.slice(0, 120) + (script.length > 120 ? "…" : ""),
        lang,
        langLabel: langLabel(lang),
        voiceLabel: vLabel,
        createdAt: Date.now(),
        chars: script.length,
      };
      const next = [item, ...history].slice(0, HISTORY_LIMIT);
      for (const old of history.slice(HISTORY_LIMIT - 1)) deleteBlob(old.id);
      saveHistory(next);
      toast({ title: "Voiceover ready", variant: "success", description: "Play it, or download the MP3." });
    } catch (e) {
      if (!stopRef.current) {
        toast({ title: "Generation failed", variant: "error", description: e instanceof Error ? e.message : "Try again." });
      }
    } finally {
      setGenerating(false);
      setGenStep("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang, history, audioUrl, toast, edgeLangs, edgeStyles, edgeVoice, edgeStyle, ratePct, pitchHz, pauseSec, useCustomRate, useCustomPitch, useCustomPause]);

  const cancelGenerate = () => {
    stopRef.current = true;
    setGenerating(false);
    setGenStep("");
  };

  const playHistory = async (item: HistoryItem) => {
    if (playingId === item.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    const entry = await getBlob(item.id);
    const blob = entry?.blob;
    if (!blob) {
      toast({ title: "Audio not found", variant: "error", description: "This recording was cleared from the device." });
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    audioRef.current = el;
    el.onended = () => setPlayingId(null);
    setPlayingId(item.id);
    el.play().catch(() => setPlayingId(null));
  };

  const downloadHistory = async (item: HistoryItem) => {
    const entry = await getBlob(item.id);
    const blob = entry?.blob;
    if (!blob) {
      toast({ title: "Audio not found", variant: "error", description: "This recording was cleared from the device." });
      return;
    }
    downloadBlob(blob, `voiceover-${item.lang}-${new Date(item.createdAt).toISOString().slice(0, 10)}.mp3`);
  };

  const deleteHistory = async (id: string) => {
    await deleteBlob(id);
    saveHistory(history.filter((h) => h.id !== id));
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  };

  const clearHistory = async () => {
    for (const h of history) await deleteBlob(h.id);
    saveHistory([]);
    audioRef.current?.pause();
    setPlayingId(null);
  };


  const overLimit = text.length > MAX_CHARS;
  // Rough estimate: ~850 characters per minute of speech.
  const estMinutes = text.trim() ? Math.max(1, Math.round((text.length / 850) * 10) / 10) : 0;

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Your script</p>
            <p className={`text-xs font-medium ${overLimit ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              {estMinutes > 0 && <span className="text-brand-700 dark:text-brand-300/80"> · ~{estMinutes} min audio</span>}
            </p>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste the text you want voiced…"
            rows={7}
          />
          <p className="text-[11px] text-zinc-500 mt-1.5">Tip: leave a blank line between paragraphs for a natural pause.</p>
        </div>

        <div>
          <label htmlFor="vo-lang" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
            <Languages size={15} className="text-brand-700 dark:text-brand-400" /> Language
          </label>
          <select id="vo-lang" value={lang} onChange={(e) => setLang(e.target.value)} className="input-base w-full">
            <optgroup label="HD AI Voices">
              {edgeLangs.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Basic voices (free)">
              {BASIC_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1.5">
            {hasPiperVoice(lang) ? (
              <><Sparkles size={12} className="text-brand-700 dark:text-brand-400" /> On-device AI voice · real {edgeVoice} voice · free · works offline after first use</>
            ) : isEdgeLang ? (
              <><Sparkles size={12} className="text-brand-700 dark:text-brand-400" /> HD AI voice · male/female · styles · free</>
            ) : (
              <>Basic free voice · MP3 download</>
            )}
          </p>
        </div>

        {showEdgeControls && (
          <>
            <div className={`grid gap-4 ${hasPiperVoice(lang) ? "grid-cols-1" : "grid-cols-2"}`}>
              <div>
                <label htmlFor="vo-evoice" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                  <Mic size={15} className="text-brand-700 dark:text-brand-400" /> Voice
                </label>
                <select id="vo-evoice" value={edgeVoice} onChange={(e) => setEdgeVoice(e.target.value as "male" | "female")} className="input-base w-full">
                  <option value="male"> Male</option>
                  <option value="female"> Female</option>
                </select>
              </div>
              {!hasPiperVoice(lang) && (
              <div>
                <label htmlFor="vo-style" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">Style</label>
                <select id="vo-style" value={edgeStyle} onChange={(e) => setEdgeStyle(e.target.value)} className="input-base w-full">
                  {edgeStyles.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={previewVoice}
                className="group inline-flex items-center gap-2.5 pl-2 pr-5 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-500/50 text-sm font-semibold text-violet-700 dark:text-violet-300 transition-all hover:scale-105 active:scale-95"
              >
                <span className="grid place-items-center size-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_4px_16px_rgba(168,85,247,0.4)] group-hover:shadow-[0_4px_24px_rgba(168,85,247,0.6)] transition-shadow">
                  {previewing ? <Square size={13} /> : <Play size={13} className="ml-0.5" />}
                </span>
                {previewing ? (previewStep || "Playing… tap to stop") : "Preview voice"}
              </button>
              <p className="text-[11px] text-zinc-500">{previewStep ? "On-device voice — first use downloads the model once." : "Hear a short sample of this voice before generating."}</p>
              <audio ref={previewAudioRef} className="hidden" aria-hidden />
            </div>

            {hasPiperVoice(lang) ? (
              <p className="text-[11px] text-zinc-500 leading-relaxed rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 p-4">
                The on-device voice speaks at its natural speed and pitch — the model is downloaded once (~60&nbsp;MB) and then works offline.
              </p>
            ) : (
            <div className="space-y-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 p-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Speed: <span className="text-brand-700 dark:text-brand-300">{useCustomRate ? `${ratePct > 0 ? "+" : ""}${ratePct}%` : "style default"}</span>
                  </p>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <input type="checkbox" checked={useCustomRate} onChange={(e) => setUseCustomRate(e.target.checked)} className="accent-brand-500" />
                    custom
                  </label>
                </div>
                <input type="range" min={-40} max={40} step={1} value={ratePct}
                  disabled={!useCustomRate}
                  onChange={(e) => setRatePct(Number(e.target.value))}
                  className="w-full accent-brand-500 disabled:opacity-30" aria-label="Speech speed percent" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Pitch: <span className="text-brand-700 dark:text-brand-300">{useCustomPitch ? `${pitchHz > 0 ? "+" : ""}${pitchHz} Hz` : "style default"}</span>
                  </p>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <input type="checkbox" checked={useCustomPitch} onChange={(e) => setUseCustomPitch(e.target.checked)} className="accent-brand-500" />
                    custom
                  </label>
                </div>
                <input type="range" min={-15} max={15} step={1} value={pitchHz}
                  disabled={!useCustomPitch}
                  onChange={(e) => setPitchHz(Number(e.target.value))}
                  className="w-full accent-brand-500 disabled:opacity-30" aria-label="Speech pitch" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Paragraph pause: <span className="text-brand-700 dark:text-brand-300">{useCustomPause ? `${pauseSec.toFixed(1)}s` : "style default"}</span>
                  </p>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <input type="checkbox" checked={useCustomPause} onChange={(e) => setUseCustomPause(e.target.checked)} className="accent-brand-500" />
                    custom
                  </label>
                </div>
                <input type="range" min={0} max={3} step={0.1} value={pauseSec}
                  disabled={!useCustomPause}
                  onChange={(e) => setPauseSec(Number(e.target.value))}
                  className="w-full accent-brand-500 disabled:opacity-30" aria-label="Paragraph pause" />
              </div>
            </div>
            )}
          </>
        )}

        {!generating ? (
          <button
            onClick={generate}
            className="group relative w-full overflow-hidden rounded-2xl px-6 py-4 text-base font-bold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 shadow-[0_8px_32px_rgba(168,85,247,0.4)] hover:shadow-[0_8px_48px_rgba(168,85,247,0.6)]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative flex items-center justify-center gap-2.5">
              <Mic size={18} className="group-hover:scale-110 transition-transform" />
              Generate voiceover
              <span className="text-xs font-medium opacity-80 bg-white/20 rounded-full px-2.5 py-0.5">MP3</span>
            </span>
          </button>
        ) : (
          <button
            onClick={cancelGenerate}
            className="w-full rounded-2xl px-6 py-4 text-base font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_8px_32px_rgba(239,68,68,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
          >
            <Square size={16} /> Stop generating
          </button>
        )}

        {generating && (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            <Loader2 size={16} className="animate-spin text-brand-700 dark:text-brand-400" />
            {genStep || "Generating voice…"}
          </div>
        )}

        {audioUrl && !generating && (
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 p-4 space-y-3 animate-fade-up">
            {engine === "piper" ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
                On-device AI Voice · {edgeVoice === "male" ? "Male" : "Female"}
              </p>
            ) : engine === "edge" || engine === "elevenlabs" ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
                 {engine === "edge" ? "HD AI Voice" : "Premium AI Voice"}
              </p>
            ) : engine === "google-fallback" || engine === "google" ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1">
                 Basic voice — on-device voice unavailable for this language
              </p>
            ) : null}
            <audio controls src={audioUrl} className="w-full" />
            <div className="grid grid-cols-1 gap-3">
              <a href={audioUrl} download={`voiceover-${lang}-${Date.now()}.mp3`}>
                <span className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:shadow-[0_4px_28px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all">
                  <Download size={16} /> Download MP3
                </span>
              </a>
            </div>
          </div>
        )}

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Free AI voices generated on your own device — the MP3 is yours to download and use anywhere.
          Your recordings stay on this device.
        </p>
      </Card>

      {history.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold flex items-center gap-2">
              <History size={16} className="text-brand-700 dark:text-brand-400" /> Your voiceovers
            </h3>
            <button onClick={clearHistory} className="text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition">
              Clear all
            </button>
          </div>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 p-3 flex items-center gap-3">
                <button
                  onClick={() => playHistory(h)}
                  className="grid place-items-center size-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_4px_16px_rgba(168,85,247,0.35)] hover:shadow-[0_4px_24px_rgba(168,85,247,0.55)] hover:scale-110 active:scale-95 transition-all shrink-0"
                  aria-label={playingId === h.id ? "Pause" : "Play"}
                >
                  {playingId === h.id ? <Square size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{h.text}</p>
                  <p className="text-[11px] text-zinc-500">
                    {h.langLabel}{h.voiceLabel ? ` · ${h.voiceLabel}` : ""} · {new Date(h.createdAt).toLocaleDateString()} · {h.chars.toLocaleString()} chars
                  </p>
                </div>
                <button onClick={() => downloadHistory(h)} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-300 transition" aria-label="Download MP3">
                  <Download size={15} />
                </button>
                <button onClick={() => deleteHistory(h.id)} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition" aria-label="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
