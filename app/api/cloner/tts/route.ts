import { NextRequest, NextResponse } from "next/server";
import { clonerFetch, readBackendJson, ClonerOffline } from "@/lib/cloner";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_CHARS = 100_000;
const VOICE_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const JOB_ID_RE = /^[a-f0-9]{12}$/;

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/**
 * POST /api/cloner/tts — JSON { voice_id, text }.
 * Rendering on the clone engine is slow (CPU), so this starts an async
 * generation job and returns { job_id } immediately. Poll
 * GET /api/cloner/tts/status?jobId=… then fetch the MP3 from
 * GET /api/cloner/tts/file?jobId=… — never fakes audio: a 503
 * { error:"cloner_offline" } when the backend is down.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`cloner:tts:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests — please try again later." },
      { status: 429 }
    );
  }

  let body: { voice_id?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 });
  }

  const voiceId = typeof body.voice_id === "string" ? body.voice_id.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!VOICE_ID_RE.test(voiceId)) {
    return NextResponse.json({ error: "bad_request", message: "Create a voice first." }, { status: 400 });
  }
  if (text.length < 1) {
    return NextResponse.json({ error: "bad_request", message: "Type the text to speak first." }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "text_too_long", message: `Keep the text under ${MAX_CHARS} characters.` },
      { status: 400 }
    );
  }

  try {
    const res = await clonerFetch("/api/tts/long", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voice_id: voiceId, text, format: "mp3", name: "Voice clone" }),
    });
    if (res.status === 404) {
      return NextResponse.json(
        { error: "voice_not_found", message: "This voice is gone — create it again in step 1." },
        { status: 400 }
      );
    }
    if (res.status === 409) {
      const data = await readBackendJson(res);
      const msg = typeof data.detail === "string" ? data.detail : "The previous render is still stopping — try again in a few seconds.";
      return NextResponse.json({ error: "busy", message: msg }, { status: 409 });
    }
    if (!res.ok) {
      const data = await readBackendJson(res);
      const msg = typeof data.detail === "string" ? data.detail : "Voice generation failed.";
      return NextResponse.json({ error: "tts_failed", message: msg }, { status: 502 });
    }
    const data = await readBackendJson(res);
    const jobId = typeof data.job_id === "string" ? data.job_id : "";
    if (!JOB_ID_RE.test(jobId)) {
      return NextResponse.json({ error: "tts_failed", message: "The engine did not start the job." }, { status: 502 });
    }
    return NextResponse.json({ job_id: jobId });
  } catch (err) {
    if (err instanceof ClonerOffline) {
      return NextResponse.json({ error: "cloner_offline" }, { status: 503 });
    }
    return NextResponse.json(
      { error: "tts_failed", message: "Voice generation failed — please try again." },
      { status: 502 }
    );
  }
}
