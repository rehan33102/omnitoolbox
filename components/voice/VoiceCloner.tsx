"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Mic, Upload, Volume2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import JsonLd from "@/components/seo/JsonLd";

/** Client-safe FAQPage JSON-LD (lib/seo.ts is server-only). */
function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

const FAQS = [
  {
    question: "How does the AI voice cloner work?",
    answer:
      "Upload a 6–30 second voice sample of a single speaker, confirm you own the voice or have permission to clone it, then type any text in English. The clone engine speaks the text in the exact voice of your sample and you download it as an MP3.",
  },
  {
    question: "Which languages can the cloned voice speak?",
    answer:
      "English works best. The cloning engine also supports Chinese, Japanese and Korean. Other languages such as Urdu, Hindi or Arabic are not supported by the engine.",
  },
  {
    question: "Is voice cloning free on OmniToolBox?",
    answer:
      "Yes — voice cloning is free to use. Generation runs on a dedicated clone engine and can take a minute or more for longer text, so please be patient while it renders.",
  },
  {
    question: "Do you store my voice sample?",
    answer:
      "Your sample is sent to the clone engine only to create your voice, and the finished audio stays with you. Clone responsibly: only use voices you own or have permission to use.",
  },
];

const MAX_CHARS = 800;
const OFFLINE_MSG = "The voice cloner is offline right now — please try again later.";

type Step = "sample" | "text";

function formatDuration(s: number | null): string {
  if (s == null || !isFinite(s)) return "";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function VoiceCloner() {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const sampleAudio = useRef<HTMLAudioElement>(null);

  const [online, setOnline] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("sample");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [duration, setDuration] = useState<number | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [renderMsg, setRenderMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const genSeq = useRef(0);
  const pollFails = useRef(0);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cloner/status")
      .then((r) => r.json())
      .then((d) => setOnline(d?.online === true))
      .catch(() => setOnline(false));
    return () => {
      stopPoll();
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopPoll() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function pickFile(f: File | undefined) {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("audio/") && !f.type.startsWith("video/") && f.type !== "") {
      setError("Please choose an audio file.");
      return;
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(f);
    setFileUrl(URL.createObjectURL(f));
    setDuration(null);
  }

  async function createVoice() {
    setError("");
    if (!file) {
      setError("Upload a voice sample first.");
      return;
    }
    if (!consent) {
      setError("Please confirm you own this voice or have permission to clone it.");
      return;
    }
    if (!voiceName.trim()) {
      setError("Give the cloned voice a name.");
      return;
    }
    setCreating(true);
    try {
      // 1) upload the sample
      setCreateMsg("Uploading your voice sample…");
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/cloner/upload", { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        if (upData?.error === "cloner_offline") throw new Error(OFFLINE_MSG);
        throw new Error(upData?.message || "Upload failed — please try again.");
      }
      // 2) create the voice from the uploaded reference
      setCreateMsg("Cloning your voice… this can take a moment.");
      const vc = await fetch("/api/cloner/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: voiceName.trim(), ref_path: upData.path, consent: true }),
      });
      const vcData = await vc.json().catch(() => ({}));
      if (!vc.ok) {
        if (vcData?.error === "cloner_offline") throw new Error(OFFLINE_MSG);
        throw new Error(vcData?.message || "Voice creation failed — please try again.");
      }
      setVoiceId(vcData.voice_id);
      setStep("text");
      toast({ variant: "success", title: "Voice cloned", description: `"${voiceName.trim()}" is ready.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setCreating(false);
      setCreateMsg("");
    }
  }

  async function generate() {
    setError("");
    if (!voiceId) {
      setError("Create a voice first.");
      return;
    }
    if (text.trim().length < 1) {
      setError("Type the text you want the voice to speak.");
      return;
    }
    stopPoll();
    const seq = ++genSeq.current;
    setGenerating(true);
    setElapsed(0);
    setRenderMsg("Rendering your voice… this usually takes 1–3 minutes.");
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
    try {
      // 1) start the render job on the clone engine
      const res = await fetch("/api/cloner/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voice_id: voiceId, text: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "cloner_offline") throw new Error(OFFLINE_MSG);
        throw new Error(data?.message || "Voice generation failed — please try again.");
      }
      const jobId = typeof data?.job_id === "string" ? data.job_id : "";
      if (!jobId) throw new Error("The engine did not start the job.");

      // 2) poll the job until it is done (rendering is slow on the engine)
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
            // 3) fetch the finished MP3
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
            setAudioUrl(URL.createObjectURL(new Blob([blob], { type: "audio/mpeg" })));
            setRenderMsg("");
            setGenerating(false);
            toast({ variant: "success", title: "Voiceover ready" });
          } else if (d.state === "error") {
            throw new Error(d?.error || "Voice generation failed — please try again.");
          } else {
            setRenderMsg("Rendering your voice… this usually takes 1–3 minutes.");
          }
        } catch (e) {
          if (seq !== genSeq.current) return;
          if (e instanceof Error && e.message === OFFLINE_MSG) {
            stopPoll();
            setGenerating(false);
            setRenderMsg("");
            setError(OFFLINE_MSG);
            return;
          }
          pollFails.current += 1;
          if (pollFails.current > 3) {
            stopPoll();
            setGenerating(false);
            setRenderMsg("");
            setError(e instanceof Error ? e.message : "Something went wrong.");
          }
          // otherwise keep polling — transient blips ride through
        }
      };
      await pollOnce();
      if (seq === genSeq.current && pollTimer.current === null) {
        pollTimer.current = setInterval(pollOnce, 4000);
      }
    } catch (e) {
      stopPoll();
      setGenerating(false);
      setRenderMsg("");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div>
      {/* Tool UI */}
      {online === false && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            The voice cloner is offline right now — please try again later.
          </p>
        </div>
      )}

      {/* Step 1 — voice sample */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-8 h-8 rounded-full grid place-items-center bg-gradient-to-r from-ember-500 to-magent-500 text-white font-bold text-sm">1</span>
          <h2 className="text-lg font-bold">Clone a voice</h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
          Upload a <strong>6–30 second</strong> recording of a single speaker, with no background noise.
          English works best — the engine also speaks Chinese, Japanese and Korean.
        </p>

        <div className="flex flex-col gap-4">
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
            aria-label="Voice sample audio file"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <Upload className="w-4 h-4" /> {file ? "Change sample" : "Upload voice sample"}
            </Button>
            {file && (
              <div className="text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-2 min-w-0">
                <Mic className="w-4 h-4 shrink-0 text-zinc-400" />
                <span className="truncate">{file.name}</span>
                {duration != null && <span className="text-zinc-500 shrink-0">({formatDuration(duration)})</span>}
              </div>
            )}
          </div>
          {fileUrl && (
            <audio
              ref={sampleAudio}
              src={fileUrl}
              controls
              preload="metadata"
              className="w-full"
              onLoadedMetadata={() => {
                const el = sampleAudio.current;
                if (el && isFinite(el.duration)) setDuration(el.duration);
              }}
            />
          )}

          <Input
            label="Voice name"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            placeholder="e.g. My narrator voice"
            maxLength={60}
          />

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-5 h-5 rounded accent-violet-600 shrink-0"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              This is my own voice, or I have permission to clone it.
            </span>
          </label>

          <div>
            <Button onClick={createVoice} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              {creating ? (createMsg || "Working…") : "Create voice"}
            </Button>
          </div>

          {voiceId && step === "text" && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Voice ready — now write what it should say below.
            </p>
          )}
        </div>
      </Card>

      {/* Step 2 — text */}
      <Card className="p-6 mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-8 h-8 rounded-full grid place-items-center bg-gradient-to-r from-ember-500 to-magent-500 text-white font-bold text-sm">2</span>
          <h2 className="text-lg font-bold">Write the script</h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
          Type in English (also Chinese, Japanese or Korean). Generation runs on the clone engine and can take a minute or more.
        </p>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hello! This is my cloned voice speaking anything I type."
          rows={5}
          maxLength={MAX_CHARS}
          aria-label="Text for the cloned voice to speak"
        />
        <div className="flex items-center justify-between mt-2 mb-4">
          <span className="text-xs text-zinc-500">{text.length}/{MAX_CHARS}</span>
          {!voiceId && <span className="text-xs text-zinc-500">Create a voice in step 1 first</span>}
        </div>

        <Button onClick={generate} disabled={generating || !voiceId}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
          {generating ? `Rendering… ${formatDuration(elapsed)}` : "Generate voiceover"}
        </Button>

        {generating && renderMsg && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{renderMsg}</p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {audioUrl && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Your cloned voiceover</p>
            <audio src={audioUrl} controls className="w-full" />
            <a
              href={audioUrl}
              download="voice-clone.mp3"
              className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              <Download className="w-4 h-4" /> Download MP3
            </a>
          </div>
        )}
      </Card>

      {/* SEO content */}
      <article className="prose dark:prose-invert max-w-none">
        <h2>Clone any voice in seconds — free AI voice cloning</h2>
        <p>
          OmniToolBox&rsquo;s AI Voice Cloner turns a short voice sample into a full voiceover artist.
          Upload a 6–30 second recording, type your script, and download a natural-sounding MP3 in the
          exact voice of your sample. Perfect for narrations, video voiceovers, podcasts and fun
          experiments with your own voice.
        </p>
        <h3>How to clone a voice in 3 steps</h3>
        <ol>
          <li><strong>Upload a voice sample.</strong> A clear 6–30 second clip of one speaker works best — no music or background noise. Confirm you own the voice or have permission to clone it.</li>
          <li><strong>Write your script.</strong> English gives the best results; Chinese, Japanese and Korean also work. Up to 800 characters per generation.</li>
          <li><strong>Generate and download.</strong> The clone engine renders your MP3 — play it in the browser or download it to use anywhere.</li>
        </ol>
        <h3>Frequently asked questions</h3>
        <JsonLd data={faqJsonLd(FAQS)} />
        {FAQS.map((f) => (
          <div key={f.question} className="not-prose mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="font-semibold mb-1">{f.question}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{f.answer}</p>
          </div>
        ))}
      </article>
    </div>
  );
}
