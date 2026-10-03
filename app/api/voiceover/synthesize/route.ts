import { NextRequest, NextResponse } from "next/server";
import { EdgeTTS } from "node-edge-tts";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

// Allow longer synthesis on plans that support it (hobby clamps to 10s;
// the client chunks text so each request stays small anyway).
export const maxDuration = 60;

const VOICE_RE = /^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/;
const MAX_CHARS = 1200;

function pct(value: number, scale: number): string {
  const p = Math.round((value - 1) * scale);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

export async function POST(req: NextRequest) {
  let body: { text?: unknown; voice?: unknown; rate?: unknown; pitch?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice = typeof body.voice === "string" ? body.voice : "";
  const rate = typeof body.rate === "number" && isFinite(body.rate) ? Math.min(2, Math.max(0.5, body.rate)) : 1;
  const pitch = typeof body.pitch === "number" && isFinite(body.pitch) ? Math.min(2, Math.max(0, body.pitch)) : 1;

  if (!text || text.length > MAX_CHARS) {
    return NextResponse.json({ error: `Text must be 1–${MAX_CHARS} characters.` }, { status: 400 });
  }
  if (!VOICE_RE.test(voice)) {
    return NextResponse.json({ error: "Invalid voice." }, { status: 400 });
  }
  const locale = voice.split("-").slice(0, 2).join("-");

  const outPath = join(tmpdir(), `tts-${randomUUID()}.mp3`);
  try {
    const tts = new EdgeTTS({
      voice,
      lang: locale,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      rate: pct(rate, 100),
      pitch: pct(pitch, 50),
      timeout: 55000,
    });
    await tts.ttsPromise(text, outPath);
    const audio = await readFile(outPath);
    if (audio.length < 1000) throw new Error("Empty audio returned");
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("TTS synthesize failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Voice generation failed. Check your connection and try again." },
      { status: 502 }
    );
  } finally {
    await unlink(outPath).catch(() => {});
  }
}
