"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Languages, Loader2, Mic, Play, Square, Trash2, Volume2, TriangleAlert, RefreshCw, History } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const MAX_CHARS = 5000;
const CHUNK_CHARS = 800;
const HISTORY_KEY = "omnitoolbox-voiceover-history";
const HISTORY_LIMIT = 20;

type VoiceInfo = { name: string; locale: string; gender: string; friendlyName: string };

type HistoryItem = {
  id: string;
  text: string;
  voice: string;
  voiceLabel: string;
  lang: string;
  langLabel: string;
  createdAt: number;
  chars: number;
};

const DEFAULT_TEXT =
  "Welcome to the OmniToolBox AI Voiceover Studio. Type or paste your script here, pick a language and voice, then press Generate — you'll get real MP3 audio you can play, download, and reuse.";

/* ---------------- IndexedDB: persists generated MP3s on the device ---------------- */
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("omnitoolbox-voiceover", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("audio");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(id: string, blob: Blob): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audio", "readwrite");
    tx.objectStore("audio").put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(id: string): Promise<Blob | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("audio", "readonly");
    const rq = tx.objectStore("audio").get(id);
    rq.onsuccess = () => resolve((rq.result as Blob) ?? null);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbDel(id: string): Promise<void> {
  const db = await idb();
  return new Promise((resolve) => {
    const tx = db.transaction("audio", "readwrite");
    tx.objectStore("audio").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function friendlyLang(locale: string): string {
  const base = locale.split("-")[0];
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(base) ?? base;
    const region = locale.split("-")[1];
    return region ? `${name} (${region})` : name;
  } catch {
    return locale;
  }
}

/** Split long scripts into sentence-aware chunks the server can handle quickly. */
function chunkText(text: string, maxLen = CHUNK_CHARS): string[] {
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

export default function VoiceoverStudio() {
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voicesState, setVoicesState] = useState<"loading" | "ready" | "failed">("loading");
  const [locale, setLocale] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [text, setText] = useState(DEFAULT_TEXT);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef(false);
  const { toast } = useToast();

  const loadVoices = useCallback(async () => {
    setVoicesState("loading");
    try {
      const res = await fetch("/api/voiceover/voices");
      if (!res.ok) throw new Error("voices failed");
      const data = (await res.json()) as { voices: VoiceInfo[] };
      if (!data.voices?.length) throw new Error("empty");
      setVoices(data.voices);
      setVoicesState("ready");
    } catch {
      setVoicesState("failed");
    }
  }, []);

  useEffect(() => {
    loadVoices();
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* ignore */
    }
  }, [loadVoices]);

  const locales = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of voices) if (!map.has(v.locale)) map.set(v.locale, friendlyLang(v.locale));
    return [...map.entries()]
      .map(([locale, label]) => ({ locale, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [voices]);

  // Default to Urdu (Pakistan) when available, else English (US).
  useEffect(() => {
    if (voicesState !== "ready" || locale) return;
    const def = voices.some((v) => v.locale === "ur-PK") ? "ur-PK" : "en-US";
    setLocale(voices.some((v) => v.locale === def) ? def : locales[0]?.locale ?? "");
  }, [voicesState, voices, locales, locale]);

  const localeVoices = useMemo(() => voices.filter((v) => v.locale === locale), [voices, locale]);

  useEffect(() => {
    if (!localeVoices.length) return;
    setVoiceName((cur) => (localeVoices.some((v) => v.name === cur) ? cur : localeVoices[0].name));
  }, [localeVoices]);

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  };

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
    if (!voiceName) {
      toast({ title: "Pick a voice", variant: "error", description: "Choose a language and voice first." });
      return;
    }
    stopRef.current = false;
    setGenerating(true);
    setGenStep("");
    try {
      const chunks = chunkText(script);
      const parts: Blob[] = [];
      for (let i = 0; i < chunks.length; i++) {
        if (stopRef.current) return;
        setGenStep(chunks.length > 1 ? `Generating part ${i + 1} of ${chunks.length}…` : "Generating voice…");
        const res = await fetch("/api/voiceover/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunks[i], voice: voiceName, rate, pitch }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? "Generation failed");
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 1000) throw new Error("Empty audio");
        parts.push(new Blob([buf], { type: "audio/mpeg" }));
      }
      if (stopRef.current) return;
      const blob = new Blob(parts, { type: "audio/mpeg" });
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await idbPut(id, blob).catch(() => {});
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      const vLabel = voices.find((v) => v.name === voiceName)?.friendlyName ?? voiceName;
      const item: HistoryItem = {
        id,
        text: script.slice(0, 120) + (script.length > 120 ? "…" : ""),
        voice: voiceName,
        voiceLabel: vLabel,
        lang: locale,
        langLabel: friendlyLang(locale),
        createdAt: Date.now(),
        chars: script.length,
      };
      const next = [item, ...history].slice(0, HISTORY_LIMIT);
      // Drop oldest audio blobs beyond the limit.
      for (const old of history.slice(HISTORY_LIMIT - 1)) idbDel(old.id);
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
  }, [text, voiceName, locale, rate, pitch, voices, history, audioUrl, toast]);

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
    const blob = await idbGet(item.id);
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
    const blob = await idbGet(item.id);
    if (!blob) {
      toast({ title: "Audio not found", variant: "error", description: "This recording was cleared from the device." });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `voiceover-${item.lang}-${new Date(item.createdAt).toISOString().slice(0, 10)}.mp3`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const deleteHistory = async (id: string) => {
    await idbDel(id);
    saveHistory(history.filter((h) => h.id !== id));
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  };

  const clearHistory = async () => {
    for (const h of history) await idbDel(h.id);
    saveHistory([]);
    audioRef.current?.pause();
    setPlayingId(null);
  };

  const overLimit = text.length > MAX_CHARS;
  const selectedVoice = voices.find((v) => v.name === voiceName);

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-300">Your script</p>
            <p className={`text-xs font-medium ${overLimit ? "text-red-400" : "text-zinc-500"}`}>
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </p>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste the text you want voiced…"
            rows={7}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="vo-lang" className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
              <Languages size={15} className="text-brand-400" /> Language
            </label>
            {voicesState === "failed" ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 flex items-center gap-3">
                <TriangleAlert size={16} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-200 flex-1">Languages couldn&apos;t load.</p>
                <Button size="sm" variant="secondary" onClick={loadVoices}>
                  <RefreshCw size={14} /> Retry
                </Button>
              </div>
            ) : (
              <select
                id="vo-lang"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                disabled={voicesState !== "ready"}
                className="input-base w-full"
              >
                {voicesState !== "ready" && <option value="">Loading languages…</option>}
                {locales.map((l) => (
                  <option key={l.locale} value={l.locale}>
                    {l.label} · {l.locale}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-zinc-500 mt-1.5">
              {voicesState === "ready" ? `${locales.length} languages · ${voices.length} voices` : "Loading the voice library…"}
            </p>
          </div>

          <div>
            <label htmlFor="vo-voice" className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
              <Volume2 size={15} className="text-brand-400" /> Voice
            </label>
            <select
              id="vo-voice"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              disabled={voicesState !== "ready" || localeVoices.length === 0}
              className="input-base w-full"
            >
              {localeVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.friendlyName} ({v.gender})
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1.5">
              {selectedVoice ? `Selected: ${selectedVoice.friendlyName}` : "Pick a language first"}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-2">
              Speed: <span className="text-brand-300">{rate.toFixed(1)}×</span>
            </p>
            <input type="range" min={0.5} max={2} step={0.1} value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full accent-brand-500" aria-label="Speech speed" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-2">
              Pitch: <span className="text-brand-300">{pitch.toFixed(1)}×</span>
            </p>
            <input type="range" min={0} max={2} step={0.1} value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="w-full accent-brand-500" aria-label="Voice pitch" />
          </div>
        </div>

        {!generating ? (
          <Button onClick={generate} className="w-full" disabled={voicesState !== "ready"}>
            <Mic size={16} /> Generate voiceover (MP3)
          </Button>
        ) : (
          <Button onClick={cancelGenerate} variant="danger" className="w-full">
            <Square size={16} /> Stop
          </Button>
        )}

        {generating && (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-400" aria-live="polite">
            <Loader2 size={16} className="animate-spin text-brand-400" />
            {genStep || "Generating voice…"}
          </div>
        )}

        {audioUrl && !generating && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 animate-fade-up">
            <audio controls src={audioUrl} className="w-full" />
            <a href={audioUrl} download={`voiceover-${locale}-${Date.now()}.mp3`}>
              <Button className="w-full" variant="secondary">
                <Download size={16} /> Download MP3
              </Button>
            </a>
          </div>
        )}

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Real AI voices generated on our server — the MP3 is yours to download and use anywhere.
          Your recordings stay on this device.
        </p>
      </Card>

      {history.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold flex items-center gap-2">
              <History size={16} className="text-brand-400" /> Your voiceovers
            </h3>
            <button onClick={clearHistory} className="text-xs text-zinc-500 hover:text-red-400 transition">
              Clear all
            </button>
          </div>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                <button
                  onClick={() => playHistory(h)}
                  className="grid place-items-center size-9 rounded-full bg-brand-500/20 border border-brand-500/30 shrink-0"
                  aria-label={playingId === h.id ? "Pause" : "Play"}
                >
                  {playingId === h.id ? <Square size={14} className="text-brand-300" /> : <Play size={14} className="text-brand-300" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{h.text}</p>
                  <p className="text-[11px] text-zinc-500">
                    {h.langLabel} · {h.voiceLabel} · {new Date(h.createdAt).toLocaleDateString()} · {h.chars.toLocaleString()} chars
                  </p>
                </div>
                <button onClick={() => downloadHistory(h)} className="p-2 text-zinc-400 hover:text-brand-300 transition" aria-label="Download MP3">
                  <Download size={15} />
                </button>
                <button onClick={() => deleteHistory(h.id)} className="p-2 text-zinc-400 hover:text-red-400 transition" aria-label="Delete">
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
