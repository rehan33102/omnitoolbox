import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const maxDuration = 30;

const CATEGORIES = ["Finance", "Technology", "Motivation", "Health", "Education", "Entertainment", "News", "Other"];
const RESOLUTIONS = ["720p", "1080p"];
const VOICES = ["male", "female"];
const LANGUAGES = ["en", "ur", "hi"];
const MAX_SCRIPT = 15000;

type Body = {
  script?: unknown;
  title?: unknown;
  category?: unknown;
  resolution?: unknown;
  voice?: unknown;
  language?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const script = typeof body.script === "string" ? body.script.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const resolution = typeof body.resolution === "string" ? body.resolution : "";
  const voice = typeof body.voice === "string" ? body.voice : "";
  const language = typeof body.language === "string" ? body.language : "";

  if (script.length < 10) return NextResponse.json({ error: "Script is too short (min 10 characters)." }, { status: 400 });
  if (script.length > MAX_SCRIPT) return NextResponse.json({ error: `Script too long (max ${MAX_SCRIPT} characters).` }, { status: 400 });
  if (!title || title.length > 120) return NextResponse.json({ error: "Title is required (max 120 characters)." }, { status: 400 });
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  if (!RESOLUTIONS.includes(resolution)) return NextResponse.json({ error: "Invalid resolution." }, { status: 400 });
  if (!VOICES.includes(voice)) return NextResponse.json({ error: "Invalid voice." }, { status: 400 });
  if (!LANGUAGES.includes(language)) return NextResponse.json({ error: "Invalid language." }, { status: 400 });

  const jobId = randomUUID().replace(/-/g, "");
  const root = process.cwd();
  const jobsDir = path.join(root, ".video-jobs");

  // Time estimate: ~800 chars ≈ 1 min of audio.
  // TTS ≈ 10s per 1000 chars, assembly ≈ 30s per minute of video, +60s overhead.
  const ttsSec = (script.length / 1000) * 10;
  const assemblySec = (script.length / 800) * 30;
  const estimatedSecTotal = Math.ceil(ttsSec + assemblySec + 60);

  try {
    await fs.mkdir(jobsDir, { recursive: true });
    await fs.mkdir(path.join(root, "public", "videos", "generated"), { recursive: true });

    await fs.writeFile(
      path.join(jobsDir, `${jobId}.json`),
      JSON.stringify({
        jobId,
        status: "queued",
        progress: 0,
        step: "Queued…",
        elapsedSec: 0,
        estimatedSecTotal,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        params: { script, title, category, resolution, voice, language },
      })
    );

    // Spawn the worker detached so it survives the request.
    // Logs go to .video-jobs/<jobId>.log
    const logFd = await fs.open(path.join(jobsDir, `${jobId}.log`), "a").then((h) => h.fd);
    const child = spawn("node", ["scripts/video-worker.mjs", jobId], {
      cwd: root,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
    child.unref();

    return NextResponse.json({ jobId, estimatedSecTotal });
  } catch (e) {
    console.error("[video-generator] spawn failed:", e);
    return NextResponse.json({ error: "Could not start generation. Please try again." }, { status: 500 });
  }
}
