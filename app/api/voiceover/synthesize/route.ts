import { NextRequest, NextResponse } from "next/server";
import { edgeTts, resolveEdgeParams, EDGE_LANGUAGES, type EdgeTtsOptions, type SpeechCue } from "@/lib/edge-tts";

export const maxDuration = 60;

const MAX_CHARS = 600;
const CHUNK_CHARS = 180;
const LANG_RE = /^[a-z]{2}(-[A-Z]{2})?$/;
const VOICE_ID_RE = /^[A-Za-z0-9]{20}$/;
const EDGE_VOICE_RE = /^(male|female)$/;
const EDGE_STYLE_RE = /^(sleep|calm|normal|energetic)$/;

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

/* ---------------- Google TTS (free fallback) ---------------- */

function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?;\n]+[.!?;\n]+["'”]?|\S[^.!?;\n]*$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const t = s.trim();
    if (!t) continue;
    if (current && `${current} ${t}`.length > CHUNK_CHARS) {
      chunks.push(current);
      current = t;
    } else {
      current = current ? `${current} ${t}` : t;
    }
  }
  if (current) chunks.push(current);
  const out: string[] = [];
  for (const c of chunks) {
    if (c.length <= CHUNK_CHARS) out.push(c);
    else for (let i = 0; i < c.length; i += CHUNK_CHARS) out.push(c.slice(i, i + CHUNK_CHARS));
  }
  return out.length > 0 ? out : [text];
}

async function googleChunk(text: string, lang: string): Promise<Buffer> {
  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8` +
    `&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://translate.google.com/" } });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error("Empty audio");
  return buf;
}

async function googleTTS(text: string, lang: string): Promise<Buffer> {
  const baseLang = lang.split("-")[0];
  const parts: Buffer[] = [];
  for (const c of chunkText(text)) {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        parts.push(await googleChunk(c, baseLang));
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    if (lastErr) throw lastErr;
    await new Promise((r) => setTimeout(r, 200));
  }
  return Buffer.concat(parts);
}

/* ---------------- ElevenLabs (premium, needs ELEVENLABS_API_KEY) ---------------- */
async function elevenLabsTTS(text: string, voiceId: string, speed: number): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ElevenLabs not configured");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, speed)) },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error("Empty audio");
  return buf;
}

/* ---------------- Edge TTS with retry (primary engine) ---------------- */

const EDGE_RETRY_ATTEMPTS = 3;
const EDGE_RETRY_BACKOFF_MS = 800;

/**
 * Microsoft Edge neural TTS, retried up to 3 times with ~800ms backoff.
 * Google is strictly a last resort — the neural voice is the product.
 */
async function edgeTtsRetry(opts: EdgeTtsOptions): Promise<{ audio: Buffer; cues: SpeechCue[] }> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= EDGE_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`[tts] Edge TTS attempt ${attempt}/${EDGE_RETRY_ATTEMPTS} voice=${opts.voice}`);
      return await edgeTts(opts);
    } catch (e) {
      lastErr = e;
      console.error(
        `[tts] Edge TTS attempt ${attempt}/${EDGE_RETRY_ATTEMPTS} failed:`,
        e instanceof Error ? e.message : e
      );
      if (attempt < EDGE_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, EDGE_RETRY_BACKOFF_MS));
      }
    }
  }
  throw lastErr;
}

/* ---------------- Handler ---------------- */

type Body = {
  text?: unknown;
  lang?: unknown;
  voiceId?: unknown;   // ElevenLabs voice id (premium)
  speed?: unknown;     // ElevenLabs speed 0.7–1.2
  voice?: unknown;     // Edge: "male" | "female"
  style?: unknown;     // Edge: sleep | calm | normal | energetic
  ratePct?: unknown;   // Edge: speed override, percent (-40..40)
  pitchHz?: unknown;   // Edge: pitch override, Hz (-15..15)
  pauseSec?: unknown;  // Edge: paragraph pause seconds (0..3)
};

function num(v: unknown): number | undefined {
  return typeof v === "number" && isFinite(v) ? v : undefined;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const lang = typeof body.lang === "string" ? body.lang : "";
  let voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
  const speed = num(body.speed) ?? 1;
  const voice = typeof body.voice === "string" && EDGE_VOICE_RE.test(body.voice) ? body.voice as "male" | "female" : "male";
  const style = typeof body.style === "string" && EDGE_STYLE_RE.test(body.style) ? body.style : "normal";
  const ratePct = num(body.ratePct);
  const pitchHz = num(body.pitchHz);
  const pauseSec = num(body.pauseSec);

  if (!text || text.length > MAX_CHARS) {
    return NextResponse.json({ error: `Text must be 1–${MAX_CHARS} characters per part.` }, { status: 400 });
  }
  if (!LANG_RE.test(lang)) {
    return NextResponse.json({ error: "Invalid language." }, { status: 400 });
  }

  try {
    let audio: Buffer | null = null;
    let cues: SpeechCue[] = [];
    let engine = "google";

    if (voiceId && VOICE_ID_RE.test(voiceId) && process.env.ELEVENLABS_API_KEY) {
      // Premium path: valid ElevenLabs voice requested and key configured.
      // Falls back to Edge neural on failure (e.g. free-plan voice limits).
      try {
        audio = await elevenLabsTTS(text, voiceId, speed);
        engine = "elevenlabs";
      } catch (e) {
        console.error("ElevenLabs failed, falling back to Edge:", e instanceof Error ? e.message : e);
        voiceId = ""; // force Edge path below
      }
    }
    if (!audio && EDGE_LANGUAGES[lang]) {
      // Primary path: Microsoft Edge neural voices (free, no key) — retried 3x.
      try {
        const p = resolveEdgeParams(lang, voice, style, ratePct, pitchHz, pauseSec);
        const r = await edgeTtsRetry({
          text,
          voice: p.voiceName,
          rate: p.rate,
          pitch: p.pitch,
          pauseSec: p.pause,
        });
        audio = r.audio;
        cues = r.cues;
        engine = "edge";
      } catch (e) {
        console.error("Edge TTS failed, falling back to Google:", e instanceof Error ? e.message : e);
        audio = await googleTTS(text, lang);
        engine = "google-fallback";
      }
    } else if (!audio) {
      audio = await googleTTS(text, lang);
    }

    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.length),
      "Cache-Control": "no-store",
      "X-TTS-Engine": engine,
    };
    if (cues.length > 0) {
      // Sentence timings (100ns-tick based, relative to this part) for SRT download.
      headers["X-Speech-Cues"] = Buffer.from(JSON.stringify(cues), "utf-8").toString("base64url");
    }
    return new NextResponse(new Uint8Array(audio), { headers });
  } catch (e) {
    console.error("TTS synthesize failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Voice generation failed. Check your connection and try again." },
      { status: 502 }
    );
  }
}
