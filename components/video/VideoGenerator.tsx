"use client";

import { useEffect, useRef, useState } from "react";
import { Clapperboard, Download, Loader2, Save, Sparkles, Film } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { saveBlob } from "@/lib/db";

const CATEGORIES = ["Finance", "Technology", "Motivation", "Health", "Education", "Entertainment", "News", "Other"];
const RESOLUTIONS = ["720p", "1080p"];
const LANGUAGES = [
  { id: "en", label: "🇺🇸 English" },
  { id: "ur", label: "🇵🇰 Urdu" },
  { id: "hi", label: "🇮🇳 Hindi" },
];
const MAX_SCRIPT = 15000;

/** Rough spoken estimate: ~800 chars per minute of narration. */
function estimateMinutes(chars: number) {
  return Math.max(1, Math.round(chars / 800));
}

/**
 * Estimated generation time in seconds.
 * Rule: TTS ≈ 10s per 1000 chars, assembly ≈ 30s per minute of video, +60s overhead.
 */
export function estimateGenSeconds(chars: number) {
  return Math.ceil((chars / 1000) * 10 + (chars / 800) * 30 + 60);
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, Math.round(sec % 60));
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

type JobState = {
  status: "idle" | "queued" | "working" | "done" | "failed";
  progress: number;
  step: string;
  videoUrl: string | null;
  error: string | null;
  elapsedSec: number;
  estimatedSecTotal: number | null;
};

const IDLE: JobState = { status: "idle", progress: 0, step: "", videoUrl: null, error: null, elapsedSec: 0, estimatedSecTotal: null };

/**
 * Video Generator — turn a script + title into a YouTube-ready video.
 * Voiceover (Edge TTS) + Ken Burns slideshow + title/end cards, rendered
 * server-side by scripts/video-worker.mjs. The UI polls job status.
 */
export default function VideoGenerator() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [category, setCategory] = useState("Motivation");
  const [resolution, setResolution] = useState("1080p");
  const [voice, setVoice] = useState<"male" | "female">("male");
  const [language, setLanguage] = useState("en");
  const [job, setJob] = useState<JobState>(IDLE);
  const [jobId, setJobId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [elapsedTick, setElapsedTick] = useState(0); // local smooth timer
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };
  useEffect(() => stopPolling, []);

  const pollStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/video-generator/status/${id}`);
      if (!res.ok) throw new Error("status failed");
      const data = await res.json();
      setJob({
        status: data.status,
        progress: data.progress ?? 0,
        step: data.step ?? "",
        videoUrl: data.videoUrl ?? null,
        error: data.error ?? null,
        elapsedSec: data.elapsedSec ?? 0,
        estimatedSecTotal: data.estimatedSecTotal ?? null,
      });
      if (data.status === "done") {
        stopPolling();
        toast({ title: "Video ready! 🎬", description: "Your video has been generated.", variant: "success" });
      } else if (data.status === "failed") {
        stopPolling();
        toast({ title: "Generation failed", description: data.error || "Unknown error.", variant: "error" });
      }
    } catch {
      // keep polling — transient network hiccup
    }
  };

  const generate = async () => {
    if (script.trim().length < 10) {
      toast({ title: "Script too short", description: "Write at least a few sentences.", variant: "error" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Title required", description: "Give your video a title.", variant: "error" });
      return;
    }
    try {
      setJob({ ...IDLE, status: "queued", step: "Starting…" });
      const res = await fetch("/api/video-generator/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.trim(), title: title.trim(), category, resolution, voice, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start generation.");
      setJobId(data.jobId);
      setJob((j) => ({ ...j, estimatedSecTotal: data.estimatedSecTotal ?? null }));
      startRef.current = Date.now();
      setElapsedTick(0);
      toast({ title: "Video generation started 🚀", description: "This runs in the background — you can keep browsing.", variant: "success" });
      pollRef.current = setInterval(() => pollStatus(data.jobId), 5000);
      tickRef.current = setInterval(() => setElapsedTick(Math.round((Date.now() - startRef.current) / 1000)), 1000);
      pollStatus(data.jobId);
    } catch (e) {
      setJob({ ...IDLE, status: "failed", error: e instanceof Error ? e.message : "Failed to start." });
      toast({ title: "Could not start", description: e instanceof Error ? e.message : "Try again.", variant: "error" });
    }
  };

  const saveToLibrary = async () => {
    if (!job.videoUrl) return;
    try {
      setSaving(true);
      const res = await fetch(job.videoUrl);
      const blob = await res.blob();
      const id = await saveBlob("video", blob, `${title.trim() || "video"}.mp4`, { tool: "video-generator" });
      if (id) toast({ title: "Saved to Library 📚", variant: "success" });
      else toast({ title: "Library unavailable", description: "This device's storage is not accessible.", variant: "error" });
    } catch {
      toast({ title: "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const busy = job.status === "queued" || job.status === "working";
  const estMin = estimateMinutes(script.length);
  const estGenSec = estimateGenSeconds(script.length);
  // Live elapsed: prefer the smooth local ticker while busy, else server value
  const elapsed = busy ? Math.max(elapsedTick, job.elapsedSec) : job.elapsedSec;

  return (
    <Card className="p-5 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center size-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white">
          <Clapperboard size={22} />
        </span>
        <div>
          <h2 className="font-bold text-lg">Video Generator</h2>
          <p className="text-xs text-zinc-500">Script → AI voiceover + visuals → YouTube-ready MP4</p>
        </div>
        <Badge variant="new" className="ml-auto">Beta</Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block md:col-span-2">
          <span className="text-sm font-semibold mb-1.5 block">Video title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
            placeholder="e.g. 5 Money Habits That Changed My Life" disabled={busy} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold mb-1.5 block">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-base w-full" disabled={busy}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold mb-1.5 block">Resolution</span>
          <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="input-base w-full" disabled={busy}>
            {RESOLUTIONS.map((r) => <option key={r} value={r}>{r} {r === "1080p" ? "(Full HD)" : "(HD)"}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold mb-1.5 block">Voice</span>
          <select value={voice} onChange={(e) => setVoice(e.target.value as "male" | "female")} className="input-base w-full" disabled={busy}>
            <option value="male">♂️ Male</option>
            <option value="female">♀️ Female</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold mb-1.5 block">Language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input-base w-full" disabled={busy}>
            {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm font-semibold mb-1.5 flex items-center justify-between">
            Video script
            <span className="text-xs font-normal text-zinc-500">
              {script.length.toLocaleString()} / {MAX_SCRIPT.toLocaleString()} chars · ~{estMin} min video
            </span>
          </span>
          <Textarea value={script} onChange={(e) => setScript(e.target.value.slice(0, MAX_SCRIPT))}
            rows={10} disabled={busy}
            placeholder="Paste or write your full video script here — the AI will narrate it and build visuals to match…" />
        </label>
      </div>

      {/* Progress */}
      {job.status !== "idle" && (
        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {busy ? <Loader2 size={16} className="animate-spin" /> : job.status === "done" ? <Film size={16} className="text-green-500" /> : null}
            <span className="flex-1">{job.step || job.status}</span>
            {busy && (
              <span className="text-xs font-normal text-zinc-500 tabular-nums">
                ⏱️ {fmtTime(elapsed)}{job.estimatedSecTotal ? ` / ~${fmtTime(job.estimatedSecTotal)}` : ""}
              </span>
            )}
          </div>
          <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-500"
              style={{ width: `${job.progress}%` }} />
          </div>
          <p className="text-xs text-zinc-500">{job.progress}% {busy && "· runs in background, safe to leave this page"}</p>
          {job.error && <p className="text-sm text-red-500">{job.error}</p>}
        </div>
      )}

      {/* Result */}
      {job.status === "done" && job.videoUrl && (
        <div className="space-y-3">
          <video src={job.videoUrl} controls playsInline className="w-full rounded-xl bg-black aspect-video" />
          <div className="flex flex-col sm:flex-row gap-2">
            <a href={job.videoUrl} download={`${title.trim() || "video"}.mp4`} className="flex-1">
              <Button size="lg" className="w-full text-base py-3">
                <Download size={20} /> Download Video
              </Button>
            </a>
            <Button variant="secondary" size="lg" onClick={saveToLibrary} disabled={saving}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? "Saving…" : "Save to Library"}
            </Button>
          </div>
        </div>
      )}

      {/* Pre-generation estimate */}
      {job.status === "idle" && script.trim().length >= 10 && (
        <div className="rounded-xl border border-dashed border-rose-500/40 bg-rose-500/5 p-3 text-sm flex items-center gap-2">
          <span>⏱️</span>
          <span>
            Estimated generation time: <strong>~{fmtTime(estGenSec)}</strong>
            <span className="text-zinc-500"> for a ~{estMin} min video</span>
          </span>
        </div>
      )}

      <Button onClick={generate} disabled={busy} className="w-full md:w-auto">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {busy ? "Generating…" : "Generate Video"}
      </Button>

      <p className="text-[11px] text-zinc-500">
        Tip: a 20–25 minute video needs roughly 16,000–20,000 characters of script.
        Visuals are auto-matched stock photos (or stylish slides when offline).
      </p>
    </Card>
  );
}
