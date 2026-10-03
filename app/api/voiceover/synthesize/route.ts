import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const MAX_CHARS = 600;
const CHUNK_CHARS = 180;
const LANG_RE = /^[a-z]{2}(-[A-Z]{2})?$/;
const VOICE_ID_RE = /^[A-Za-z0-9]{20}$/;

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

/* ---------------- Google TTS (free, always available) ---------------- */

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

/* ---------------- Handler ---------------- */

export async function POST(req: NextRequest) {
  let body: { text?: unknown; lang?: unknown; voiceId?: unknown; speed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const lang = typeof body.lang === "string" ? body.lang : "";
  const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
  const speed = typeof body.speed === "number" && isFinite(body.speed) ? body.speed : 1;

  if (!text || text.length > MAX_CHARS) {
    return NextResponse.json({ error: `Text must be 1–${MAX_CHARS} characters per part.` }, { status: 400 });
  }
  if (!LANG_RE.test(lang)) {
    return NextResponse.json({ error: "Invalid language." }, { status: 400 });
  }

  try {
    let audio: Buffer;
    // Premium path: valid ElevenLabs voice requested and key configured.
    if (voiceId && VOICE_ID_RE.test(voiceId) && process.env.ELEVENLABS_API_KEY) {
      audio = await elevenLabsTTS(text, voiceId, speed);
    } else {
      audio = await googleTTS(text, lang);
    }
    return new NextResponse(new Uint8Array(audio), {
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
  }
}
