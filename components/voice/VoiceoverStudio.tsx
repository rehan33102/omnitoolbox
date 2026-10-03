"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Languages, Loader2, Mic, Play, Square, Trash2, History, FileText, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { deleteBlob, getBlob, saveBlob } from "@/lib/db";

const MAX_CHARS = 20000; // ~15-18 minutes of speech — no small limits
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
  { key: "sleep", label: "😴 Sleep / Deep Calm" },
  { key: "calm", label: "🌿 Calm Story" },
  { key: "normal", label: "🎙️ Normal" },
  { key: "energetic", label: "⚡ Energetic / YouTube" },
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
  srt?: string;
};

type ElevenVoice = { id: string; name: string; gender: string };
type EdgeLang = { code: string; label: string; flag: string };
type EdgeStyle = { key: string; label: string };
type SpeechCue = { start: number; end: number; text: string };

const DEFAULT_TEXT =
  "Assalam o alaikum! Welcome to the OmniToolBox AI Voiceover Studio. Type or paste your script here, pick a language, then press Generate — you'll get real MP3 audio you can play, download, and reuse.";

/* Localized preview samples — one short line per neural-voice language. */
const PREVIEW_SAMPLES: Record<string, string> = {
  en: "Hello! This is a preview of the selected voice.",
  es: "¡Hola! Esta es una vista previa de la voz seleccionada.",
  ur: "السلام علیکم! یہ منتخب آواز کا پیش نظارہ ہے۔",
  de: "Hallo! Dies ist eine Vorschau der ausgewählten Stimme.",
  ja: "こんにちは！選択した音声のプレビューです。",
  fr: "Bonjour ! Ceci est un aperçu de la voix sélectionnée.",
};

type TtsEngine = "edge" | "elevenlabs" | "google" | "google-fallback" | "";

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

function srtTime(t: number): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

/** Build an SRT from per-part audio durations + server sentence timings (or estimates). */
async function buildSrt(parts: { text: string; blob: Blob; cues: SpeechCue[] }[]): Promise<string> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const out: string[] = [];
    let idx = 1;
    let cursor = 0;
    for (const part of parts) {
      let dur = 0;
      try {
        const ab = await part.blob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(ab.slice(0));
        dur = decoded.duration;
      } catch {
        // estimate ~14 chars/sec if decode fails
        dur = Math.max(0.5, part.text.length / 14);
      }
      if (part.cues.length > 0) {
        for (const c of part.cues) {
          const s = cursor + c.start;
          const e = cursor + Math.max(c.end, c.start + 0.2);
          out.push(`${idx++}\n${srtTime(s)} --> ${srtTime(e)}\n${c.text.trim()}\n`);
        }
      } else {
        const sents = part.text.match(/[^.!?…۔؟\n]+[.!?…۔؟]+["'”]?|[^\n]+$/g) ?? [part.text];
        const total = sents.reduce((a, s) => a + s.length, 0) || 1;
        let t = cursor;
        for (const s of sents) {
          const d = Math.max(0.2, dur * (s.length / total));
          const txt = s.trim();
          if (txt) out.push(`${idx++}\n${srtTime(t)} --> ${srtTime(t + d)}\n${txt}\n`);
          t += d;
        }
      }
      cursor += dur;
    }
    return out.join("\n");
  } finally {
    ctx.close().catch(() => {});
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export default function VoiceoverStudio() {
  const [lang, setLang] = useState("ur");
  const [text, setText] = useState(DEFAULT_TEXT);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [srtText, setSrtText] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  // Premium (ElevenLabs) controls — only shown when the server has a key.
  const [premium, setPremium] = useState(false);
  const [elevenVoices, setElevenVoices] = useState<ElevenVoice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [speed, setSpeed] = useState(1);
  // Edge neural voice controls (free, primary engine).
  const [edgeLangs, setEdgeLangs] = useState<EdgeLang[]>(EDGE_LANGS_FALLBACK);
  const [edgeStyles, setEdgeStyles] = useState<EdgeStyle[]>(EDGE_STYLES_FALLBACK);
  const [edgeVoice, setEdgeVoice] = useState<"male" | "female">("male");
  const [edgeStyle, setEdgeStyle] = useState("sleep");
  const [ratePct, setRatePct] = useState(0);   // speed override, -40..40 (0 = style default)
  const [pitchHz, setPitchHz] = useState(0);   // pitch override, -15..15 (0 = style default)
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [useCustomPitch, setUseCustomPitch] = useState(false);
  const [pauseSec, setPauseSec] = useState(0.5);
  const [useCustomPause, setUseCustomPause] = useState(false);
  const [engine, setEngine] = useState<TtsEngine>("");
  const [previewing, setPreviewing] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef(false);
  const { toast } = useToast();

  const isEdgeLang = edgeLangs.some((l) => l.code === lang);
  const showEdgeControls = isEdgeLang && !premium;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* ignore */
    }
    fetch("/api/voiceover/config")
      .then((r) => r.json())
      .then((c: { provider?: string; voices?: ElevenVoice[]; edge?: { languages?: EdgeLang[]; styles?: EdgeStyle[] } }) => {
        if (c.edge?.languages?.length) setEdgeLangs(c.edge.languages);
        if (c.edge?.styles?.length) setEdgeStyles(c.edge.styles);
        if (c.provider === "elevenlabs" && c.voices?.length) {
          setPremium(true);
          setElevenVoices(c.voices);
          setVoiceId(c.voices[0].id);
        }
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

  /** Preview the selected voice/style with a short localized sample — not saved to history. */
  const previewVoice = useCallback(async () => {
    if (previewing) {
      previewAudioRef.current?.pause();
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch("/api/voiceover/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: PREVIEW_SAMPLES[lang] ?? PREVIEW_SAMPLES.en,
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
    setSrtText("");
    try {
      const parts = chunkText(script);
      const partData: { text: string; blob: Blob; cues: SpeechCue[] }[] = [];
      for (let i = 0; i < parts.length; i++) {
        if (stopRef.current) return;
        setGenStep(parts.length > 1 ? `Generating part ${i + 1} of ${parts.length}…` : "Generating voice…");
        const payload: Record<string, unknown> = { text: parts[i], lang };
        if (premium && voiceId) {
          payload.voiceId = voiceId;
          payload.speed = speed;
        } else if (edgeLangs.some((l) => l.code === lang)) {
          payload.voice = edgeVoice;
          payload.style = edgeStyle;
          if (useCustomRate) payload.ratePct = ratePct;
          if (useCustomPitch) payload.pitchHz = pitchHz;
          if (useCustomPause) payload.pauseSec = pauseSec;
        } else {
          payload.speed = speed;
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
        if (i === 0) {
          const h = res.headers.get("X-TTS-Engine");
          setEngine(h === "edge" || h === "elevenlabs" || h === "google" || h === "google-fallback" ? h : "google");
        }
        let cues: SpeechCue[] = [];
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
        partData.push({ text: parts[i], blob: new Blob([buf], { type: "audio/mpeg" }), cues });
      }
      if (stopRef.current) return;
      const blob = new Blob(partData.map((p) => p.blob), { type: "audio/mpeg" });
      const fileName = `voiceover-${lang}-${new Date().toISOString().slice(0, 10)}.mp3`;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      // SRT subtitles from real timings (or estimates).
      let srt = "";
      try {
        srt = await buildSrt(partData);
        setSrtText(srt);
      } catch {
        /* SRT is best-effort */
      }
      const vLabel = premium
        ? elevenVoices.find((v) => v.id === voiceId)?.name
        : edgeLangs.some((l) => l.code === lang)
          ? `${edgeVoice === "male" ? "Male" : "Female"} · ${edgeStyles.find((s) => s.key === edgeStyle)?.label ?? edgeStyle}`
          : undefined;
      // Persist the MP3 to the central library (kind "voiceover"), SRT in meta.
      const blobId = await saveBlob("voiceover", blob, fileName, {
        text: script.slice(0, 100) + (script.length > 100 ? "…" : ""),
        lang,
        langLabel: langLabel(lang),
        voiceLabel: vLabel ?? "",
        chars: script.length,
        srt: srt || "",
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
        srt: srt || undefined,
      };
      const next = [item, ...history].slice(0, HISTORY_LIMIT);
      for (const old of history.slice(HISTORY_LIMIT - 1)) deleteBlob(old.id);
      saveHistory(next);
      toast({ title: "Voiceover ready", variant: "success", description: "Play it, or download the MP3 + SRT." });
    } catch (e) {
      if (!stopRef.current) {
        toast({ title: "Generation failed", variant: "error", description: e instanceof Error ? e.message : "Try again." });
      }
    } finally {
      setGenerating(false);
      setGenStep("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang, history, audioUrl, toast, premium, voiceId, speed, edgeLangs, edgeStyles, edgeVoice, edgeStyle, ratePct, pitchHz, pauseSec, useCustomRate, useCustomPitch, useCustomPause]);

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

  const downloadHistorySrt = (item: HistoryItem) => {
    if (!item.srt) {
      toast({ title: "No subtitles", variant: "error", description: "This recording has no subtitle data." });
      return;
    }
    downloadBlob(new Blob([item.srt], { type: "text/srt" }), `voiceover-${item.lang}-${new Date(item.createdAt).toISOString().slice(0, 10)}.srt`);
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

  const downloadSrt = () => {
    if (!srtText) return;
    downloadBlob(new Blob([srtText], { type: "text/srt" }), `voiceover-${lang}-${Date.now()}.srt`);
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
            <optgroup label="✨ Neural voices (Microsoft · free)">
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
            {isEdgeLang ? (
              <><Sparkles size={12} className="text-brand-700 dark:text-brand-400" /> Microsoft neural voice · male/female · styles · free</>
            ) : (
              <>Basic free voice · MP3 download</>
            )}
          </p>
        </div>

        {showEdgeControls && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="vo-evoice" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                  <Mic size={15} className="text-brand-700 dark:text-brand-400" /> Voice
                </label>
                <select id="vo-evoice" value={edgeVoice} onChange={(e) => setEdgeVoice(e.target.value as "male" | "female")} className="input-base w-full">
                  <option value="male">👨 Male</option>
                  <option value="female">👩 Female</option>
                </select>
              </div>
              <div>
                <label htmlFor="vo-style" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">Style</label>
                <select id="vo-style" value={edgeStyle} onChange={(e) => setEdgeStyle(e.target.value)} className="input-base w-full">
                  {edgeStyles.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={previewVoice}
                className="btn-base inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-500/40 bg-brand-500/10 text-sm font-medium text-brand-800 dark:text-brand-200 hover:bg-brand-500/20 transition"
              >
                {previewing ? <Square size={14} /> : <Play size={14} />}
                {previewing ? "Playing preview… (tap to stop)" : "🔊 Preview voice"}
              </button>
              <p className="text-[11px] text-zinc-500">Hear a short sample of this voice before generating.</p>
              <audio ref={previewAudioRef} className="hidden" aria-hidden />
            </div>

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
          </>
        )}

        {premium && (
          <>
            <div>
              <label htmlFor="vo-voice" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                <Mic size={15} className="text-brand-700 dark:text-brand-400" /> Voice
              </label>
              <select id="vo-voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="input-base w-full">
                <optgroup label="Female">
                  {elevenVoices.filter((v) => v.gender === "Female").map((v) => (
                    <option key={v.id} value={v.id}>{v.name} · Female</option>
                  ))}
                </optgroup>
                <optgroup label="Male">
                  {elevenVoices.filter((v) => v.gender === "Male").map((v) => (
                    <option key={v.id} value={v.id}>{v.name} · Male</option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-zinc-500 mt-1.5">Premium natural voices</p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Speed: <span className="text-brand-700 dark:text-brand-300">{speed.toFixed(2)}×</span>
              </p>
              <input type="range" min={0.7} max={1.2} step={0.05} value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-brand-500" aria-label="Speech speed" />
            </div>
          </>
        )}

        {!generating ? (
          <Button onClick={generate} className="w-full">
            <Mic size={16} /> Generate voiceover (MP3 + SRT)
          </Button>
        ) : (
          <Button onClick={cancelGenerate} variant="danger" className="w-full">
            <Square size={16} /> Stop
          </Button>
        )}

        {generating && (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            <Loader2 size={16} className="animate-spin text-brand-700 dark:text-brand-400" />
            {genStep || "Generating voice…"}
          </div>
        )}

        {audioUrl && !generating && (
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 p-4 space-y-3 animate-fade-up">
            {engine === "edge" || engine === "elevenlabs" ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
                ✨ {engine === "edge" ? "Neural voice (Microsoft)" : "Premium neural voice (ElevenLabs)"}
              </p>
            ) : engine === "google-fallback" || engine === "google" ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1">
                ⚠️ Basic voice — neural was unavailable, try again
              </p>
            ) : null}
            <audio controls src={audioUrl} className="w-full" />
            <div className="grid grid-cols-2 gap-3">
              <a href={audioUrl} download={`voiceover-${lang}-${Date.now()}.mp3`}>
                <Button className="w-full" variant="secondary">
                  <Download size={16} /> MP3
                </Button>
              </a>
              <Button className="w-full" variant="secondary" onClick={downloadSrt} disabled={!srtText}>
                <FileText size={16} /> SRT subtitles
              </Button>
            </div>
          </div>
        )}

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Free AI voices generated on our server — the MP3 + subtitles are yours to download and use anywhere.
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
                  className="grid place-items-center size-9 rounded-full bg-brand-500/20 border border-brand-500/30 shrink-0"
                  aria-label={playingId === h.id ? "Pause" : "Play"}
                >
                  {playingId === h.id ? <Square size={14} className="text-brand-700 dark:text-brand-300" /> : <Play size={14} className="text-brand-700 dark:text-brand-300" />}
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
                {h.srt && (
                  <button onClick={() => downloadHistorySrt(h)} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-300 transition" aria-label="Download SRT">
                    <FileText size={15} />
                  </button>
                )}
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
