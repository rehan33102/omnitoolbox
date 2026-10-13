/**
 * Client-side Microsoft Edge TTS — runs directly in the user's browser.
 * 
 * Why client-side? Vercel's serverless functions cannot maintain the
 * WebSocket connection to Microsoft's speech API (their IPs appear to be
 * blocked/throttled). The user's browser CAN connect directly — no server
 * needed, no API key, free male/female neural voices.
 */

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const VOICE_LIST_URL = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=" + TRUSTED_CLIENT_TOKEN;
const SYNTH_BASE = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN;

export type EdgeVoiceInfo = {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName: string;
};

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ssml(text: string, voice: string, rate: string, pitch: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'><prosody rate='${rate}' pitch='${pitch}'>${esc}</prosody></voice></speak>`;
}

export type ClientTtsResult = {
  audio: Blob;
  engine: "edge-client";
};

/**
 * Synthesize speech directly in the browser via Edge TTS WebSocket.
 * Returns an MP3 Blob.
 */
export async function synthesizeInBrowser(
  text: string,
  voiceShortName: string,
  opts: { rate?: string; pitch?: string; timeoutMs?: number } = {}
): Promise<ClientTtsResult> {
  const rate = opts.rate ?? "+0%";
  const pitch = opts.pitch ?? "+0Hz";
  const timeoutMs = opts.timeoutMs ?? 30000;

  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    const connectionId = uuid().replace(/-/g, "");
    const wsUrl = `${SYNTH_BASE}&ConnectionId=${connectionId}`;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      reject(new Error("WebSocket not supported"));
      return;
    }

    ws.binaryType = "arraybuffer";
    const audioChunks: ArrayBuffer[] = [];
    const requestId = uuid().replace(/-/g, "");
    let settled = false;

    const cleanup = () => {
      try { ws.close(); } catch { /* noop */ }
    };

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (audioChunks.length === 0) {
        reject(new Error("No audio received"));
        return;
      }
      const blob = new Blob(audioChunks, { type: "audio/mpeg" });
      resolve({ audio: blob, engine: "edge-client" });
    };

    const timer = setTimeout(() => fail("Edge TTS timed out"), timeoutMs);

    ws.onopen = () => {
      // Config message
      const configMsg =
        `X-Timestamp:${new Date().toUTCString()}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      ws.send(configMsg);

      // SSML message
      const ssmlMsg =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${new Date().toUTCString()}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml(text, voiceShortName, rate, pitch);
      ws.send(ssmlMsg);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = event.data as string;
        if (msg.includes("Path:turn.end")) {
          clearTimeout(timer);
          done();
        } else if (msg.includes("Path:turn.start")) {
          // Synthesis started — noop
        }
        return;
      }

      // Binary message — extract audio data after "Path:audio\r\n" separator
      // (matches the proven edge-tts npm package implementation)
      const buffer = event.data as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      const separator = "Path:audio\r\n";
      const sepBytes = new TextEncoder().encode(separator);
      const idx = findSequence(bytes, sepBytes);
      if (idx >= 0) {
        const audioStart = idx + sepBytes.length;
        if (audioStart < bytes.length) {
          audioChunks.push(buffer.slice(audioStart));
        }
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      fail("Edge TTS WebSocket error");
    };

    ws.onclose = (event) => {
      clearTimeout(timer);
      if (!settled) {
        if (audioChunks.length > 0) {
          done();
        } else {
          fail(`Edge TTS connection closed (code ${event.code})`);
        }
      }
    };
  });
}

function findSequence(haystack: Uint8Array, needle: Uint8Array): number {
  // Find needle byte sequence in haystack
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Fetch available Edge voices (for language/voice mapping). Cached in memory. */
let voiceCache: EdgeVoiceInfo[] | null = null;
export async function getEdgeVoices(): Promise<EdgeVoiceInfo[]> {
  if (voiceCache) return voiceCache;
  const res = await fetch(VOICE_LIST_URL);
  if (!res.ok) throw new Error("Failed to fetch voices");
  voiceCache = await res.json();
  return voiceCache!;
}

/* ------------------------------------------------------------------ */
/* Voice name mapping (mirrors server lib/edge-tts.ts EDGE_LANGUAGES)  */
/* ------------------------------------------------------------------ */

const VOICE_MAP: Record<string, { male: string; female: string }> = {
  en: { male: "en-US-BrianNeural", female: "en-US-AvaNeural" },
  es: { male: "es-ES-AlvaroNeural", female: "es-ES-ElviraNeural" },
  ur: { male: "ur-PK-AsadNeural", female: "ur-PK-UzmaNeural" },
  de: { male: "de-DE-ConradNeural", female: "de-DE-KatjaNeural" },
  ja: { male: "ja-JP-KeitaNeural", female: "ja-JP-NanamiNeural" },
  fr: { male: "fr-FR-HenriNeural", female: "fr-FR-DeniseNeural" },
  hi: { male: "hi-IN-MadhurNeural", female: "hi-IN-SwaraNeural" },
  ar: { male: "ar-SA-HamedNeural", female: "ar-SA-ZariyahNeural" },
  pt: { male: "pt-BR-AntonioNeural", female: "pt-BR-FranciscaNeural" },
  ru: { male: "ru-RU-DmitryNeural", female: "ru-RU-SvetlanaNeural" },
  zh: { male: "zh-CN-YunxiNeural", female: "zh-CN-XiaoxiaoNeural" },
  it: { male: "it-IT-DiegoNeural", female: "it-IT-ElsaNeural" },
  tr: { male: "tr-TR-AhmetNeural", female: "tr-TR-EmelNeural" },
  ko: { male: "ko-KR-InJoonNeural", female: "ko-KR-SunHiNeural" },
  nl: { male: "nl-NL-MaartenNeural", female: "nl-NL-ColetteNeural" },
  pl: { male: "pl-PL-MarekNeural", female: "pl-PL-ZofiaNeural" },
  id: { male: "id-ID-ArdiNeural", female: "id-ID-GadisNeural" },
  ms: { male: "ms-MY-OsmanNeural", female: "ms-MY-YasminNeural" },
  bn: { male: "bn-BD-PradeepNeural", female: "bn-BD-NabanitaNeural" },
  ta: { male: "ta-IN-ValluvarNeural", female: "ta-IN-PallaviNeural" },
  te: { male: "te-IN-MohanNeural", female: "te-IN-ShrutiNeural" },
  fa: { male: "fa-IR-FaridNeural", female: "fa-IR-DilaraNeural" },
  th: { male: "th-TH-NiwatNeural", female: "th-TH-PremwadeeNeural" },
  vi: { male: "vi-VN-NamMinhNeural", female: "vi-VN-HoaiMyNeural" },
  sv: { male: "sv-SE-MattiasNeural", female: "sv-SE-SofieNeural" },
  da: { male: "da-DK-JeppeNeural", female: "da-DK-ChristelNeural" },
  fi: { male: "fi-FI-HarriNeural", female: "fi-FI-NooraNeural" },
  no: { male: "nb-NO-FinnNeural", female: "nb-NO-PernilleNeural" },
  el: { male: "el-GR-NestorasNeural", female: "el-GR-AthinaNeural" },
  he: { male: "he-IL-AvriNeural", female: "he-IL-HilaNeural" },
  ro: { male: "ro-RO-EmilNeural", female: "ro-RO-AlinaNeural" },
  uk: { male: "uk-UA-OstapNeural", female: "uk-UA-PolinaNeural" },
  cs: { male: "cs-CZ-AntoninNeural", female: "cs-CZ-VlastaNeural" },
};

/** Get the Edge voice ShortName for a language + gender. Returns null if not mapped. */
export function getVoiceName(lang: string, gender: "male" | "female"): string | null {
  const entry = VOICE_MAP[lang];
  if (!entry) return null;
  return gender === "male" ? entry.male : entry.female;
}

/** Check if a language has client-side Edge TTS support. */
export function hasClientVoice(lang: string): boolean {
  return lang in VOICE_MAP;
}
