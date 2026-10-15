"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Check, Download, Loader2, Mic, Pause, Play,
  RotateCcw, Square, Trash2, Upload, Volume2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { CLONER_PRESETS, PURPOSE_PRESETS, type ClonerPreset } from "@/lib/cloner-presets";

const MAX_CHARS = 100_000;
const OFFLINE_MSG = "The voice studio is offline right now — please try again later.";

/* Retry windows for cloner API calls: the voice backend restarts routinely
   (the host wipes/restarts it), so a generation-start call that fails with
   cloner_offline — or a raw network failure — waits 10s and retries for up
   to ~3 minutes before surfacing the offline error. During retries the UI
   shows a calm busy state (never an error), and a retry that eventually
   succeeds continues the normal flow unchanged. */
const RETRY_INTERVAL_MS = 10000;
const RETRY_WINDOW_MS = 180000; // ~3 minutes
const RETRY_MSG = "Connecting to the voice engine… this can take a moment — your voiceover will start automatically.";
const RETRY_MSG_CLONE = "Connecting to the voice engine… this can take a moment — your clone will start automatically.";
const RETRY_CANCELLED = "__cloner_retry_cancelled";

/** Re-run `fn` on cloner_offline / network failure until RETRY_WINDOW_MS passes. */
async function withClonerRetry<T>(
  fn: () => Promise<T>,
  onRetry: () => void,
  isCancelled?: () => boolean
): Promise<T> {
  const deadline = Date.now() + RETRY_WINDOW_MS;
  for (;;) {
    if (isCancelled?.()) throw new Error(RETRY_CANCELLED);
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Error && e.message === RETRY_CANCELLED) throw e;
      if (isCancelled?.()) throw new Error(RETRY_CANCELLED);
      const offline =
        (e instanceof Error && e.message === OFFLINE_MSG) || e instanceof TypeError;
      if (!offline || Date.now() >= deadline) throw e;
      onRetry();
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
    }
  }
}

/* ---------- tiny IndexedDB store for "My voiceovers" ---------- */
interface SavedVoiceover {
  id: string;
  name: string;
  voiceLabel: string;
  text: string;
  createdAt: number;
  blob: Blob;
  jobId?: string;
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open("voice-studio", 1);
    rq.onupgradeneeded = () => {
      rq.result.createObjectStore("voiceovers", { keyPath: "id" });
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

async function idbAll(): Promise<SavedVoiceover[]> {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const rq = db.transaction("voiceovers").objectStore("voiceovers").getAll();
      rq.onsuccess = () => resolve((rq.result as SavedVoiceover[]).sort((a, b) => b.createdAt - a.createdAt));
      rq.onerror = () => reject(rq.error);
    });
  } catch {
    return [];
  }
}

async function idbPut(item: SavedVoiceover): Promise<void> {
  try {
    const db = await idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("voiceovers", "readwrite");
      tx.objectStore("voiceovers").put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* storage is best-effort */ }
}

async function idbDelete(id: string): Promise<void> {
  try {
    const db = await idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("voiceovers", "readwrite");
      tx.objectStore("voiceovers").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

/* ---------- helpers ---------- */
function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function fmtSize(n: number): string {
  return n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}
function safeFileName(name: string): string {
  return name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "voiceover";
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

type Mode = "ready" | "clone";
type Source = "record" | "upload";
type RecState = "idle" | "recording" | "recorded";

export default function VoiceCloner() {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [online, setOnline] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("ready");

  /* ready voices */
  const [genderF, setGenderF] = useState<"All" | "Male" | "Female">("All");
  const [accentF, setAccentF] = useState<"All" | "American" | "British">("All");
  const [presetSlug, setPresetSlug] = useState("ryan");
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);

  /* clone */
  const [source, setSource] = useState<Source>("record");
  const [inApp, setInApp] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [fileFromRec, setFileFromRec] = useState(false);
  const [voiceName, setVoiceName] = useState("");
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [cloned, setCloned] = useState<{ id: string; name: string } | null>(null);

  /* recorder */
  const [recState, setRecState] = useState<RecState>("idle");
  const [recSecs, setRecSecs] = useState(0);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* compose */
  const [purpose, setPurpose] = useState("youtube");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [renderMsg, setRenderMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const genSeq = useRef(0);
  const pollFails = useRef(0);
  const [result, setResult] = useState<{ url: string; blob: Blob; label: string; jobId: string } | null>(null);
  const [error, setError] = useState("");

  /* library */
  const [library, setLibrary] = useState<SavedVoiceover[]>([]);
  const [libPlaying, setLibPlaying] = useState<string | null>(null);
  const libAudio = useRef<HTMLAudioElement | null>(null);
  const [libUrls, setLibUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    // The backend's free tunnel address rotates about hourly, which can
    // show a brief false "offline" — keep re-checking so the banner
    // clears itself as soon as the studio is reachable again.
    let alive = true;
    const checkStatus = () =>
      fetch("/api/cloner/status")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setOnline(d?.online === true);
        })
        .catch(() => {
          if (alive) setOnline(false);
        });
    checkStatus();
    const statusTimer = setInterval(checkStatus, 25_000);
    // In-app browsers (WebViews) can never grant the mic — land those
    // visitors on the upload path, which works everywhere, with a hint.
    if (/; wv\)|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent)) {
      setInApp(true);
      setSource("upload");
    }
    idbAll().then(setLibrary);
    return () => {
      alive = false;
      clearInterval(statusTimer);
      stopPoll();
      stopStream();
      previewAudio.current?.pause();
      libAudio.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopPoll() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }
  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (recTimer.current) clearInterval(recTimer.current);
  }

  const preset: ClonerPreset = CLONER_PRESETS.find((p) => p.slug === presetSlug) || CLONER_PRESETS[0];
  const activeVoiceId = mode === "ready" ? preset.voiceId : cloned?.id || null;
  const activeVoiceLabel =
    mode === "ready" ? `${preset.name} · ${preset.gender} · ${preset.accent}` : cloned ? `${cloned.name} · your clone` : "";

  /* ---------- previews ---------- */
  function togglePreview(p: ClonerPreset) {
    if (playingPreview === p.slug) {
      previewAudio.current?.pause();
      setPlayingPreview(null);
      return;
    }
    previewAudio.current?.pause();
    const a = new Audio(p.preview);
    previewAudio.current = a;
    a.onended = () => setPlayingPreview(null);
    a.onerror = () => setPlayingPreview(null);
    a.play().catch(() => setPlayingPreview(null));
    setPlayingPreview(p.slug);
  }

  /* ---------- sample picking ---------- */
  function setSample(f: File, fromRec: boolean) {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(f);
    setFileUrl(URL.createObjectURL(f));
    setFileFromRec(fromRec);
    setCloned(null);
  }
  function clearSample() {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(null);
    setFileUrl("");
    setFileFromRec(false);
    setRecState("idle");
    setRecSecs(0);
  }
  function pickFile(f: File | undefined) {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("audio/") && !f.type.startsWith("video/") && f.type !== "") {
      setError("Please choose an audio file.");
      return;
    }
    setSample(f, false);
  }

  /* ---------- recorder (WhatsApp-style) ---------- */
  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
        .find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stopStream();
        const type = mr.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        const f = new File([blob], `voice-sample.${ext}`, { type });
        setSample(f, true);
        setRecState("recorded");
      };
      mr.start(250);
      setRecState("recording");
      setRecSecs(0);
      const t0 = Date.now();
      recTimer.current = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        setRecSecs(s);
        if (s >= 30) stopRecording();
      }, 250);
    } catch (e) {
      const name = (e as { name?: string })?.name || "";
      // Android WebViews (in-app browsers) can never grant the mic — the
      // host app blocks it before any prompt. Detect and say so plainly.
      const inAppBrowser = /; wv\)|FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(navigator.userAgent);
      if (inAppBrowser) {
        setError("Recording doesn't work inside app browsers — the app blocks the microphone. Open this page in Chrome to record, or stay here and use \"Upload from gallery\" with a recording from your phone's voice recorder app.");
      } else if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Microphone is blocked for this site. Tap the icon at the left of the address bar → Site settings → Microphone → Allow, then tap record again. Or upload a recording from your gallery instead.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No microphone was found on this device. You can upload a recording from your gallery instead.");
      } else {
        setError("Recording is not available in this browser. Open this page in Chrome, or upload a recording from your gallery instead.");
      }
    }
  }
  function stopRecording() {
    if (recTimer.current) clearInterval(recTimer.current);
    if (mrRef.current && mrRef.current.state === "recording") mrRef.current.stop();
  }
  function discardRecording() {
    clearSample();
  }

  /* ---------- clone creation ---------- */
  async function createVoice() {
    setError("");
    if (!file) { setError("Record or upload a voice sample first."); return; }
    if (!consent) { setError("Please confirm you own this voice or have permission to clone it."); return; }
    if (!voiceName.trim()) { setError("Give the cloned voice a name."); return; }
    setCreating(true);
    try {
      setCreateMsg("Uploading your sample…");
      const fd = new FormData();
      fd.append("file", file);
      const upData = await withClonerRetry(
        async () => {
          const up = await fetch("/api/cloner/upload", { method: "POST", body: fd });
          const d = await up.json().catch(() => ({}));
          if (!up.ok) {
            if (d?.error === "cloner_offline") throw new Error(OFFLINE_MSG);
            throw new Error(d?.message || "Upload failed — please try again.");
          }
          return d;
        },
        () => setCreateMsg(RETRY_MSG_CLONE)
      );
      setCreateMsg("Cloning your voice…");
      const vcData = await withClonerRetry(
        async () => {
          const vc = await fetch("/api/cloner/voice", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: voiceName.trim(), ref_path: upData.path, consent: true }),
          });
          const d = await vc.json().catch(() => ({}));
          if (!vc.ok) {
            if (d?.error === "cloner_offline") throw new Error(OFFLINE_MSG);
            throw new Error(d?.message || "Voice creation failed — please try again.");
          }
          return d;
        },
        () => setCreateMsg(RETRY_MSG_CLONE)
      );
      setCloned({ id: vcData.voice_id, name: voiceName.trim() });
      toast({ variant: "success", title: "Voice cloned", description: `"${voiceName.trim()}" is ready below.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setCreating(false);
      setCreateMsg("");
    }
  }

  /* ---------- generation ---------- */
  async function generate() {
    setError("");
    if (!activeVoiceId) { setError("Pick a voice first — or clone yours in the Clone tab."); return; }
    if (text.trim().length < 1) { setError("Type the text you want spoken."); return; }
    stopPoll();
    const seq = ++genSeq.current;
    const purposePreset = PURPOSE_PRESETS.find((p) => p.id === purpose) || PURPOSE_PRESETS[0];
    const label = activeVoiceLabel;
    setGenerating(true);
    setElapsed(0);
    setRenderMsg("Rendering your voice… this usually takes 1–3 minutes.");
    if (result) { URL.revokeObjectURL(result.url); setResult(null); }
    try {
      const data = await withClonerRetry(
        async () => {
          const res = await fetch("/api/cloner/tts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              voice_id: activeVoiceId,
              text: text.trim(),
              speed: purposePreset.speed,
              pause_mult: purposePreset.pauseMult,
            }),
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (d?.error === "cloner_offline") throw new Error(OFFLINE_MSG);
            throw new Error(d?.message || "Voice generation failed — please try again.");
          }
          return d;
        },
        () => { if (seq === genSeq.current) setRenderMsg(RETRY_MSG); },
        () => seq !== genSeq.current
      );
      const jobId = typeof data?.job_id === "string" ? data.job_id : "";
      if (!jobId) throw new Error("The engine did not start the job.");

      pollFails.current = 0;
      const startedAt = Date.now();
      const pollOnce = async () => {
        if (seq !== genSeq.current) return;
        try {
          const r = await fetch(`/api/cloner/tts/status?jobId=${encodeURIComponent(jobId)}`);
          const d = await r.json().catch(() => ({}));
          if (!r.ok) {
            if (d?.error === "cloner_offline") throw new Error("Status check hiccup — retrying.");
            throw new Error(d?.message || "Could not check the render.");
          }
          pollFails.current = 0;
          if (seq !== genSeq.current) return;
          setElapsed(Math.round((Date.now() - startedAt) / 1000));
          if (d.state === "done") {
            stopPoll();
            setRenderMsg("Fetching your audio…");
            const f = await fetch(`/api/cloner/tts/file?jobId=${encodeURIComponent(jobId)}`);
            if (!f.ok) {
              const fd = await f.json().catch(() => ({}));
              if (fd?.error === "cloner_offline") throw new Error("Download hiccup — retrying.");
              throw new Error(fd?.message || "Could not fetch the finished audio.");
            }
            const blob = await f.blob();
            if (blob.size < 1000) throw new Error("The voice came back empty.");
            if (seq !== genSeq.current) return;
            const mp3 = new Blob([blob], { type: "audio/mpeg" });
            setResult({ url: URL.createObjectURL(mp3), blob: mp3, label, jobId });
            setRenderMsg("");
            setGenerating(false);
            // auto-save to "My voiceovers" on this device
            const item: SavedVoiceover = {
              id: `${Date.now()}-${jobId}`,
              name: `${label.split(" · ")[0]} — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
              voiceLabel: label,
              text: text.trim(),
              createdAt: Date.now(),
              blob: mp3,
              jobId,
            };
            await idbPut(item);
            setLibrary(await idbAll());
            toast({ variant: "success", title: "Voiceover ready", description: "Saved to My voiceovers on this device." });
          } else if (d.state === "error") {
            throw new Error(d?.error || "Voice generation failed — please try again.");
          }
        } catch (e) {
          if (seq !== genSeq.current) return;
          if (e instanceof Error && e.message === OFFLINE_MSG) {
            stopPoll(); setGenerating(false); setRenderMsg(""); setError(OFFLINE_MSG);
            return;
          }
          pollFails.current += 1;
          if (pollFails.current > 3) {
            stopPoll(); setGenerating(false); setRenderMsg("");
            setError(e instanceof Error ? e.message : "Something went wrong.");
          }
        }
      };
      await pollOnce();
      if (seq === genSeq.current && pollTimer.current === null) {
        pollTimer.current = setInterval(pollOnce, 4000);
      }
    } catch (e) {
      if (e instanceof Error && e.message === RETRY_CANCELLED) return; // superseded by a newer generation
      stopPoll();
      setGenerating(false);
      setRenderMsg("");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  /* ---------- library actions ---------- */
  function libPlay(item: SavedVoiceover) {
    if (libPlaying === item.id) {
      libAudio.current?.pause();
      setLibPlaying(null);
      return;
    }
    libAudio.current?.pause();
    let url = libUrls[item.id];
    if (!url) {
      url = URL.createObjectURL(item.blob);
      setLibUrls((m) => ({ ...m, [item.id]: url }));
    }
    const a = new Audio(url);
    libAudio.current = a;
    a.onended = () => setLibPlaying(null);
    a.play().catch(() => setLibPlaying(null));
    setLibPlaying(item.id);
  }
  async function libDelete(item: SavedVoiceover) {
    if (libPlaying === item.id) { libAudio.current?.pause(); setLibPlaying(null); }
    await idbDelete(item.id);
    setLibrary(await idbAll());
    toast({ variant: "success", title: "Deleted", description: "Removed from this device." });
  }
  function libReuse(item: SavedVoiceover) {
    setText(item.text.slice(0, MAX_CHARS));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const filteredPresets = CLONER_PRESETS.filter(
    (p) => (genderF === "All" || p.gender === genderF) && (accentF === "All" || p.accent === accentF)
  );

  const chip = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
      active
        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
        : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-500"
    }`;

  return (
    <div>
      {online === false && (
        <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 anim-vs-in">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{OFFLINE_MSG}</p>
        </div>
      )}

      {/* ---------- studio shell ---------- */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl shadow-zinc-900/5 overflow-hidden">
        {/* mode tabs */}
        <div className="p-3 sm:p-4 border-b border-zinc-100 dark:border-zinc-900">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            {(
              [
                { id: "ready", label: "Ready voices" },
                { id: "clone", label: "Clone your voice" },
              ] as { id: Mode; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  mode === t.id
                    ? "bg-gradient-to-r from-ember-500 to-magent-500 text-white shadow-md"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ----- READY VOICES ----- */}
        {mode === "ready" && (
          <div className="p-4 sm:p-6 anim-vs-in" key="ready">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(["All", "Male", "Female"] as const).map((g) => (
                <button key={g} className={chip(genderF === g)} onClick={() => setGenderF(g)}>{g === "All" ? "All voices" : g}</button>
              ))}
              <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1" />
              {(["All", "American", "British"] as const).map((a) => (
                <button key={a} className={chip(accentF === a)} onClick={() => setAccentF(a)}>{a === "All" ? "All accents" : a}</button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPresets.map((p) => {
                const selected = presetSlug === p.slug;
                const playing = playingPreview === p.slug;
                return (
                  <div
                    key={p.slug}
                    onClick={() => setPresetSlug(p.slug)}
                    className={`group relative rounded-2xl border p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                      selected
                        ? "border-transparent ring-2 ring-violet-500 bg-violet-50/60 dark:bg-violet-500/5"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${p.gradient} grid place-items-center text-white font-extrabold text-lg shrink-0 shadow-md`}>
                        {p.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-tight flex items-center gap-2">
                          {p.name}
                          {selected && <Check className="w-4 h-4 text-violet-500" />}
                        </p>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{p.gender} · {p.accent}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">{p.blurb}</p>
                      </div>
                      <button
                        aria-label={`Preview ${p.name}`}
                        onClick={(e) => { e.stopPropagation(); togglePreview(p); }}
                        className={`w-9 h-9 rounded-full grid place-items-center shrink-0 transition-all duration-200 ${
                          playing ? "bg-violet-600 text-white scale-105" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredPresets.length === 0 && (
                <p className="text-sm text-zinc-500 col-span-full py-4 text-center">No voices match this filter.</p>
              )}
            </div>
          </div>
        )}

        {/* ----- CLONE ----- */}
        {mode === "clone" && (
          <div className="p-4 sm:p-6 anim-vs-in" key="clone">
            <div className="flex gap-2 mb-5">
              {!inApp && (
                <button className={chip(source === "record")} onClick={() => setSource("record")}>
                  <Mic className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Record live
                </button>
              )}
              <button className={chip(source === "upload")} onClick={() => setSource("upload")}>
                <Upload className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Upload from gallery
              </button>
            </div>

            {source === "record" && !inApp && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 text-center">
                {recState === "idle" && (
                  <div className="anim-vs-in">
                    <button
                      onClick={startRecording}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-ember-500 to-magent-500 text-white grid place-items-center mx-auto shadow-lg shadow-magent-500/25 hover:scale-105 active:scale-95 transition-transform duration-200"
                      aria-label="Start recording"
                    >
                      <Mic className="w-9 h-9" />
                    </button>
                    <p className="mt-3 text-sm font-semibold">Tap to record your voice</p>
                    <p className="text-xs text-zinc-500">6–30 seconds of clear speech, no music or noise</p>
                  </div>
                )}
                {recState === "recording" && (
                  <div className="anim-vs-in">
                    <div className="relative w-20 h-20 mx-auto">
                      <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                      <button
                        onClick={stopRecording}
                        className="relative w-20 h-20 rounded-full bg-red-500 text-white grid place-items-center shadow-lg hover:scale-105 active:scale-95 transition-transform duration-200"
                        aria-label="Stop recording"
                      >
                        <Square className="w-8 h-8" />
                      </button>
                    </div>
                    <div className="flex items-end justify-center gap-1 h-6 mt-4" aria-hidden>
                      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                        <span key={i} className="w-1.5 h-6 rounded bg-red-400 anim-vs-eq" style={{ animationDelay: `${i * 0.11}s` }} />
                      ))}
                    </div>
                    <p className="mt-2 text-sm font-bold text-red-500">Recording… {fmtTime(recSecs)}</p>
                    <p className="text-xs text-zinc-500">Tap the button to stop (auto-stops at 0:30)</p>
                  </div>
                )}
                {recState === "recorded" && file && (
                  <div className="anim-vs-in text-left">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" /> Recording captured ({fmtTime(recSecs)})
                    </p>
                    {fileUrl && <audio src={fileUrl} controls className="w-full mb-3" />}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={discardRecording} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                      <button onClick={() => { discardRecording(); setTimeout(startRecording, 50); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Retake
                      </button>
                      <span className="text-xs text-zinc-500 self-center">Happy with it? Name it below and create the clone.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {source === "upload" && (
              <div className="anim-vs-in">
                <input
                  ref={fileInput}
                  type="file"
                  accept="audio/*,video/*"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                  aria-label="Voice sample audio file"
                />
                <button
                  onClick={() => fileInput.current?.click()}
                  className="w-full rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center hover:border-violet-400 transition-colors duration-200"
                >
                  <Upload className="w-7 h-7 mx-auto text-zinc-400" />
                  <p className="mt-2 text-sm font-semibold">{file && !fileFromRec ? file.name : "Choose a voice sample from your gallery"}</p>
                  <p className="text-xs text-zinc-500">6–30 seconds of one clear voice · MP3, WAV, M4A…</p>
                </button>
                {file && !fileFromRec && fileUrl && <audio src={fileUrl} controls className="w-full mt-3" />}
              </div>
            )}

            <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-5 items-end">
              <label className="block">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Voice name</span>
                <input
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="e.g. My voice"
                  maxLength={60}
                  className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 transition"
                />
              </label>
              <button
                onClick={createVoice}
                disabled={creating || !file}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-ember-500 to-magent-500 text-white text-sm font-bold shadow-md hover:opacity-95 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none"
              >
                {creating ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{createMsg || "Working…"}</span> : "Create my clone"}
              </button>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none mt-4">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-5 h-5 rounded accent-violet-600 shrink-0" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">This is my own voice, or I have permission to clone it.</span>
            </label>
            {cloned && (
              <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 anim-vs-in">
                <Check className="w-4 h-4" /> “{cloned.name}” is ready — write your script below and generate.
              </p>
            )}
          </div>
        )}

        {/* ----- compose deck ----- */}
        <div className="border-t border-zinc-100 dark:border-zinc-900 p-4 sm:p-6 bg-zinc-50/60 dark:bg-zinc-900/30">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mr-1">Purpose</span>
            {PURPOSE_PRESETS.map((p) => (
              <button key={p.id} className={chip(purpose === p.id)} onClick={() => setPurpose(p.id)}>{p.label}</button>
            ))}
          </div>

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type what the voice should say… English works best (Chinese, Japanese & Korean also work)."
              rows={5}
              maxLength={MAX_CHARS}
              aria-label="Script text"
              className="w-full rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3.5 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-violet-500 transition resize-y min-h-[120px]"
            />
            <span className="absolute bottom-3 right-3.5 text-[11px] font-medium text-zinc-400">
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
            <p className="text-xs text-zinc-500 order-2 sm:order-1">
              Voice: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{activeVoiceLabel || "—"}</span>
            </p>
            <button
              onClick={generate}
              disabled={generating || online === false}
              className="order-1 sm:order-2 sm:ml-auto relative overflow-hidden px-8 py-3.5 rounded-2xl bg-gradient-to-r from-ember-500 to-magent-500 text-white font-extrabold text-[15px] shadow-lg shadow-magent-500/25 hover:opacity-95 active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {generating && <span className="absolute inset-0 anim-vs-shimmer" aria-hidden />}
              <span className="relative inline-flex items-center gap-2">
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
                {generating ? `Generating… ${fmtTime(elapsed)}` : "Generate voiceover"}
              </span>
            </button>
          </div>
          {generating && renderMsg && <p className="mt-2.5 text-xs text-zinc-500 anim-vs-in">{renderMsg}</p>}

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5 anim-vs-in">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </p>
          )}

          {result && (
            <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 anim-vs-in">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2.5">Your voiceover is ready</p>
              <audio src={result.url} controls className="w-full" />
              <div className="flex flex-wrap gap-2 mt-3.5">
                <a
                  href={`/api/cloner/tts/file?jobId=${encodeURIComponent(result.jobId)}`}
                  download={`${safeFileName(result.label.split(" · ")[0])}-voiceover.mp3`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow hover:bg-emerald-500 active:scale-[0.98] transition"
                >
                  <Download className="w-4 h-4" /> Download MP3
                </a>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 self-center">
                  <Check className="w-3.5 h-3.5" /> Auto-saved in My voiceovers below
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- My voiceovers ---------- */}
      {library.length > 0 && (
        <div className="mt-8 anim-vs-in">
          <h3 className="font-display text-lg font-extrabold mb-1">My voiceovers</h3>
          <p className="text-xs text-zinc-500 mb-4">Saved on this device — play, download or delete anytime.</p>
          <div className="flex flex-col gap-2.5">
            {library.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 flex items-center gap-3 transition-shadow hover:shadow-md">
                <button
                  onClick={() => libPlay(item)}
                  aria-label={libPlaying === item.id ? "Pause" : "Play"}
                  className={`w-10 h-10 rounded-full grid place-items-center shrink-0 transition-all duration-200 ${
                    libPlaying === item.id ? "bg-violet-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {libPlaying === item.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{item.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{item.text.slice(0, 90)}{item.text.length > 90 ? "…" : ""}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{item.voiceLabel} · {fmtSize(item.blob.size)}</p>
                </div>
                <button
                  onClick={() => libReuse(item)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 transition-colors shrink-0"
                >
                  Reuse text
                </button>
                {item.jobId ? (
                  <a
                    href={`/api/cloner/tts/file?jobId=${encodeURIComponent(item.jobId)}`}
                    download={`${safeFileName(item.name)}.mp3`}
                    aria-label="Download"
                    className="w-9 h-9 grid place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    onClick={() => downloadBlob(item.blob, `${safeFileName(item.name)}.mp3`)}
                    aria-label="Download"
                    className="w-9 h-9 grid place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => libDelete(item)}
                  aria-label="Delete"
                  className="w-9 h-9 grid place-items-center rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-red-500 hover:border-red-300 transition shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
