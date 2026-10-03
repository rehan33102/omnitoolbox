// lib/edge-tts.ts — Microsoft Edge neural TTS client.
// Implements the Edge read-aloud WebSocket protocol directly with Node built-ins
// (tls / net / crypto) — no npm dependencies. Free, no API key.
//
// Protocol (reverse-engineered from the edge-tts Python package):
//  1. wss://speech.platform.bing.com/.../edge/v1?TrustedClientToken=...&ConnectionId=...&Sec-MS-GEC=...&Sec-MS-GEC-Version=...
//  2. Send speech.config JSON, then SSML.
//  3. Receive audio (binary frames) + sentence-boundary metadata, until turn.end.

import tls from "tls";
import net from "net";
import crypto from "crypto";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const HOST = "speech.platform.bing.com";
const WS_PATH = "/consumer/speech/synthesize/readaloud/edge/v1";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const EDGE_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0`;
const ORIGIN = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";

/* ------------------------------------------------------------------ voices */

export interface EdgeLang {
  label: string;
  flag: string;
  locale: string;
  voices: { male: string; female: string };
  /** pitch is scaled down for non-English languages (sounds more natural) */
  pitchScale: number;
}

export const EDGE_LANGUAGES: Record<string, EdgeLang> = {
  en: { label: "English", flag: "🇺🇸", locale: "en-US",
        voices: { male: "en-US-BrianNeural", female: "en-US-AvaNeural" }, pitchScale: 1.0 },
  es: { label: "Spanish", flag: "🇪🇸", locale: "es-ES",
        voices: { male: "es-ES-AlvaroNeural", female: "es-ES-ElviraNeural" }, pitchScale: 0.6 },
  ur: { label: "Urdu", flag: "🇵🇰", locale: "ur-PK",
        voices: { male: "ur-PK-AsadNeural", female: "ur-PK-UzmaNeural" }, pitchScale: 0.5 },
  de: { label: "German", flag: "🇩🇪", locale: "de-DE",
        voices: { male: "de-DE-ConradNeural", female: "de-DE-KatjaNeural" }, pitchScale: 0.65 },
  ja: { label: "Japanese", flag: "🇯🇵", locale: "ja-JP",
        voices: { male: "ja-JP-KeitaNeural", female: "ja-JP-NanamiNeural" }, pitchScale: 0.35 },
  fr: { label: "French", flag: "🇫🇷", locale: "fr-FR",
        voices: { male: "fr-FR-HenriNeural", female: "fr-FR-DeniseNeural" }, pitchScale: 0.65 },
};

export interface EdgeStyle { label: string; rate: number; pitch: number; pause: number }

export const EDGE_STYLES: Record<string, EdgeStyle> = {
  sleep:     { label: "😴 Sleep / Deep Calm",  rate: -14, pitch: -6, pause: 0.8 },
  calm:      { label: "🌿 Calm Story",         rate: -8,  pitch: -3, pause: 0.5 },
  normal:    { label: "🎙️ Normal",             rate: 0,   pitch: 0,  pause: 0.3 },
  energetic: { label: "⚡ Energetic / YouTube", rate: 8,   pitch: 2,  pause: 0.2 },
};

export interface SpeechCue { start: number; end: number; text: string }

/* ------------------------------------------------------------- DRM helpers */

function generateSecMsGec(clockSkewSec = 0): string {
  // Windows file-time ticks, rounded down to 5 minutes, SHA256 hex uppercase.
  const WIN_EPOCH = 11644473600;
  let ticks = Date.now() / 1000 + WIN_EPOCH + clockSkewSec;
  ticks -= ticks % 300;
  ticks *= 1e7;
  const strToHash = `${Math.round(ticks)}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}

function jsDateString(): string {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

/* --------------------------------------------------------------- SSML text */

function cleanText(t: string): string {
  return t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

function xmlEscape(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSsml(text: string, voice: string, rate: string, pitch: string): string {
  // NOTE: the Edge service rejects <break/> elements (closes the connection),
  // so paragraph pauses are handled by synthesizing paragraphs separately
  // and joining with silent MP3 frames (see edgeTts below).
  const body = xmlEscape(cleanText(text)).replace(/\s*\n\s*/g, " ");
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${body}</prosody></voice></speak>`;
}

/* --------------------------------- silence frames ---------------------------------
 * The output format is 24kHz 48kbps mono CBR MP3: 144 bytes = 24ms per frame.
 * This is ~1s of silent frames in exactly that format (from the desktop app's
 * assets), embedded as base64 so it works on serverless with no file I/O. */
const SILENCE_B64 =
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV" +
  "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV" +
  "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV" +
  "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV" +
  "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV" +
  "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV" +
  "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV" +
  "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVV" +
  "VVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
  "VVVVVVVVVVVVVVVVVVVVVVVV";
const SILENCE_FRAME = 144;
const SILENCE_FRAME_SEC = 0.024;

let silenceBuf: Buffer | null = null;
function getSilenceBuf(): Buffer {
  if (!silenceBuf) silenceBuf = Buffer.from(SILENCE_B64, "base64");
  return silenceBuf;
}

/** Raw silent MP3 bytes lasting ~`sec` seconds (same 24kHz/48k/mono format). */
function silenceBytes(sec: number): Buffer {
  const frames = Math.max(0, Math.round(sec / SILENCE_FRAME_SEC));
  if (frames === 0) return Buffer.alloc(0);
  const src = getSilenceBuf();
  const need = frames * SILENCE_FRAME;
  const out = Buffer.alloc(need);
  for (let off = 0; off < need; off += src.length) {
    src.copy(out, off, 0, Math.min(src.length, need - off));
  }
  return out;
}

/** CBR 48kbps -> exact duration in seconds for a byte count. */
function mp3Seconds(bytes: number): number {
  return (bytes * 8) / 48000;
}

/* ------------------------------------------------------------ socket layer */

function tcpConnect(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, host);
    const timer = setTimeout(() => { s.destroy(); reject(new Error("TCP connect timeout")); }, timeoutMs);
    s.once("connect", () => { clearTimeout(timer); resolve(s); });
    s.once("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

function readUntil(sock: net.Socket | tls.TLSSocket, marker: Buffer, timeoutMs: number): Promise<{ head: Buffer; rest: Buffer }> {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const timer = setTimeout(() => { sock.off("data", onData); reject(new Error("Read timeout")); }, timeoutMs);
    const onData = (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      const idx = buf.indexOf(marker);
      // IMPORTANT: keep bytes after the marker — the server may pipeline
      // WebSocket frames in the same TCP segment as the HTTP response.
      if (idx !== -1) {
        clearTimeout(timer);
        sock.off("data", onData);
        resolve({ head: buf.subarray(0, idx + marker.length), rest: buf.subarray(idx + marker.length) });
      }
    };
    sock.on("data", onData);
    sock.once("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

async function connectTls(timeoutMs: number): Promise<tls.TLSSocket> {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "";
  let raw: net.Socket;
  if (proxyUrl) {
    const u = new URL(proxyUrl);
    raw = await tcpConnect(u.hostname, Number(u.port) || 3128, timeoutMs);
    let auth = "";
    if (u.username) {
      auth = `Proxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64")}\r\n`;
    }
    raw.write(`CONNECT ${HOST}:443 HTTP/1.1\r\nHost: ${HOST}:443\r\n${auth}\r\n`);
    const { head: connectHead } = await readUntil(raw, Buffer.from("\r\n\r\n"), timeoutMs);
    const status = connectHead.toString("latin1").split("\r\n")[0];
    if (!/^HTTP\/1\.[01] 200/.test(status)) { raw.destroy(); throw new Error(`Proxy CONNECT failed: ${status}`); }
  } else {
    raw = await tcpConnect(HOST, 443, timeoutMs);
  }
  const tlsSock = tls.connect({ socket: raw, servername: HOST });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TLS timeout")), timeoutMs);
    tlsSock.once("secureConnect", () => { clearTimeout(timer); resolve(); });
    tlsSock.once("error", (e) => { clearTimeout(timer); reject(e); });
  });
  return tlsSock;
}

/* ---------------------------------------------------------- WS frame layer */

function maskedTextFrame(text: string): Buffer {
  const data = Buffer.from(text, "utf-8");
  const mask = crypto.randomBytes(4);
  let header: Buffer;
  if (data.length < 126) {
    header = Buffer.from([0x81, 0x80 | data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  const out = Buffer.alloc(header.length + 4 + data.length);
  header.copy(out, 0);
  mask.copy(out, header.length);
  for (let i = 0; i < data.length; i++) out[header.length + 4 + i] = data[i] ^ mask[i % 4];
  return out;
}

interface WsMessage { opcode: number; payload: Buffer }

/** Incrementally reads complete WS messages (handles fragmentation, ping/pong). */
class WsReader {
  private buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private queue: WsMessage[] = [];
  private waiter: { resolve: (m: WsMessage) => void; reject: (e: Error) => void } | null = null;
  private fragOpcode = 0;
  private fragParts: Buffer[] = [];

  constructor(private sock: tls.TLSSocket, private onFatal: (e: Error) => void, seed?: Buffer) {
    if (seed && seed.length > 0) this.buf = seed;
    sock.on("data", (d: Buffer) => this.ingest(d));
    sock.on("error", (e) => this.fail(e));
    sock.on("close", () => this.fail(new Error("Socket closed")));
  }

  private ingest(d: Buffer) {
    this.buf = Buffer.concat([this.buf, d]);
    try {
      while (this.buf.length >= 2) {
        const b0 = this.buf[0], b1 = this.buf[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        let len = b1 & 0x7f, off = 2;
        if (len === 126) {
          if (this.buf.length < 4) return;
          len = this.buf.readUInt16BE(2); off = 4;
        } else if (len === 127) {
          if (this.buf.length < 10) return;
          len = Number(this.buf.readBigUInt64BE(2)); off = 10;
          if (!Number.isSafeInteger(len)) throw new Error("Frame too large");
        }
        if ((b1 & 0x80) !== 0) throw new Error("Server sent masked frame");
        if (this.buf.length < off + len) return;
        const payload = this.buf.subarray(off, off + len);
        this.buf = this.buf.subarray(off + len);

        if (opcode === 0x9) { // ping -> pong
          this.sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
          continue;
        }
        if (opcode === 0x8) { this.fail(new Error("Server closed WebSocket")); return; }
        if (opcode === 0x0) { // continuation
          this.fragParts.push(payload);
          if (fin) { this.deliver({ opcode: this.fragOpcode, payload: Buffer.concat(this.fragParts) }); this.fragParts = []; }
          continue;
        }
        if (!fin) { this.fragOpcode = opcode; this.fragParts = [payload]; continue; }
        this.deliver({ opcode, payload });
      }
    } catch (e) {
      this.fail(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private deliver(m: WsMessage) {
    if (this.waiter) { const w = this.waiter; this.waiter = null; w.resolve(m); }
    else this.queue.push(m);
  }

  private fail(e: Error) {
    if (this.waiter) { const w = this.waiter; this.waiter = null; w.reject(e); }
    this.onFatal(e);
  }

  next(timeoutMs: number): Promise<WsMessage> {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiter = null; reject(new Error("WS read timeout")); }, timeoutMs);
      this.waiter = {
        resolve: (m) => { clearTimeout(timer); resolve(m); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      };
    });
  }
}

function parseTextHeaders(raw: string): { headers: Record<string, string>; body: string } {
  const idx = raw.indexOf("\r\n\r\n");
  const head = idx === -1 ? raw : raw.slice(0, idx);
  const body = idx === -1 ? "" : raw.slice(idx + 4);
  const headers: Record<string, string> = {};
  for (const line of head.split("\r\n")) {
    const c = line.indexOf(":");
    if (c > 0) headers[line.slice(0, c)] = line.slice(c + 1);
  }
  return { headers, body };
}

/** Parse a binary audio message: [u16 BE header len][headers][mp3 data]. */
function parseBinaryAudio(payload: Buffer): Buffer | null {
  if (payload.length < 2) return null;
  const hlen = payload.readUInt16BE(0);
  if (2 + hlen > payload.length) return null;
  const head = payload.subarray(2, 2 + hlen).toString("latin1");
  const headers: Record<string, string> = {};
  for (const line of head.split("\r\n")) {
    const c = line.indexOf(":");
    if (c > 0) headers[line.slice(0, c)] = line.slice(c + 1);
  }
  if (headers["Path"] !== "audio") return null;
  const data = payload.subarray(2 + hlen);
  if (data.length === 0) return null;
  return data;
}

/* ------------------------------------------------------------------ main */

export interface EdgeTtsOptions {
  text: string;
  voice: string;      // e.g. "ur-PK-AsadNeural"
  rate: string;       // e.g. "+0%" / "-14%"
  pitch: string;      // e.g. "+0Hz" / "-6Hz"
  pauseSec?: number;  // paragraph pause
  timeoutMs?: number;
}

export async function edgeTts(opts: EdgeTtsOptions): Promise<{ audio: Buffer; cues: SpeechCue[] }> {
  // Paragraphs are synthesized separately (the Edge service rejects <break/>
  // tags), then joined with silent MP3 frames — same approach as the desktop app.
  const paragraphs = opts.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    return edgeTtsSingle(opts);
  }
  const pauseSec = opts.pauseSec ?? 0.3;
  const results = await mapLimit(paragraphs, 4, (para) => edgeTtsSingle({ ...opts, text: para }));
  const audioParts: Buffer[] = [];
  const cues: SpeechCue[] = [];
  let cursor = 0;
  results.forEach((r, i) => {
    audioParts.push(r.audio);
    for (const c of r.cues) cues.push({ start: cursor + c.start, end: cursor + c.end, text: c.text });
    cursor += mp3Seconds(r.audio.length);
    if (i < results.length - 1 && pauseSec > 0) {
      const sil = silenceBytes(pauseSec);
      audioParts.push(sil);
      cursor += mp3Seconds(sil.length);
    }
  });
  return { audio: Buffer.concat(audioParts), cues };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function edgeTtsSingle(opts: EdgeTtsOptions): Promise<{ audio: Buffer; cues: SpeechCue[] }> {
  const timeoutMs = opts.timeoutMs ?? 45000;
  let clockSkew = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await runOnce({ ...opts, timeoutMs }, clockSkew);
    } catch (e: unknown) {
      const err = e as { code?: string; skew?: number };
      if (attempt === 0 && err && err.code === "EDGE_403" && typeof err.skew === "number") {
        clockSkew = err.skew;
        continue;
      }
      throw e;
    }
  }
  throw new Error("Edge TTS failed");
}

async function runOnce(opts: EdgeTtsOptions & { timeoutMs: number }, clockSkew: number) {
  const sock = await connectTls(12000);
  const deadline = Date.now() + opts.timeoutMs;
  const remaining = () => Math.max(1000, deadline - Date.now());
  let fatal: Error | null = null;

  try {
    const connId = crypto.randomUUID().replace(/-/g, "");
    const gec = generateSecMsGec(clockSkew);
    const muid = crypto.randomBytes(16).toString("hex").toUpperCase();
    const wsKey = crypto.randomBytes(16).toString("base64");
    const path = `${WS_PATH}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connId}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    sock.write(
      `GET ${path} HTTP/1.1\r\n` +
      `Host: ${HOST}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${wsKey}\r\n` +
      `Sec-WebSocket-Version: 13\r\n` +
      `Origin: ${ORIGIN}\r\n` +
      `User-Agent: ${EDGE_UA}\r\n` +
      `Accept-Language: en-US,en;q=0.9\r\n` +
      `Pragma: no-cache\r\n` +
      `Cache-Control: no-cache\r\n` +
      `Cookie: muid=${muid};\r\n\r\n`
    );

    const { head: hsHead, rest: hsRest } = await readUntil(sock, Buffer.from("\r\n\r\n"), remaining());
    const hs = hsHead.toString("latin1");
    const statusLine = hs.split("\r\n")[0];
    if (/^HTTP\/1\.[01] 403/.test(statusLine)) {
      // Clock skew: recompute token from the server Date header.
      const m = hs.match(/Date:\s*([^\r\n]+)/i);
      let skew = 0;
      if (m) {
        const serverTs = Date.parse(m[1].trim()) / 1000;
        if (isFinite(serverTs)) skew = serverTs - Date.now() / 1000;
      }
      const err = new Error(`Edge handshake 403`) as Error & { code: string; skew: number };
      err.code = "EDGE_403"; err.skew = skew;
      throw err;
    }
    if (!/^HTTP\/1\.[01] 101/.test(statusLine)) {
      throw new Error(`WebSocket handshake failed: ${statusLine}`);
    }
    // Seed the frame reader with any bytes that arrived with the handshake.
    const reader = new WsReader(sock, (e) => { fatal = e; }, hsRest);

    const dateStr = jsDateString();
    const configMsg =
      `X-Timestamp:${dateStr}\r\n` +
      `Content-Type:application/json; charset=utf-8\r\n` +
      `Path:speech.config\r\n\r\n` +
      `{"context":{"synthesis":{"audio":{"metadataoptions":{` +
      `"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},` +
      `"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;
    sock.write(maskedTextFrame(configMsg));

    const requestId = crypto.randomUUID().replace(/-/g, "");
    const ssml = buildSsml(opts.text, opts.voice, opts.rate, opts.pitch);
    const ssmlMsg =
      `X-RequestId:${requestId}\r\n` +
      `Content-Type:application/ssml+xml\r\n` +
      `X-Timestamp:${dateStr}Z\r\n` +
      `Path:ssml\r\n\r\n` +
      ssml;
    sock.write(maskedTextFrame(ssmlMsg));

    const audioParts: Buffer[] = [];
    const cues: SpeechCue[] = [];
    for (;;) {
      const msg = await reader.next(remaining());
      if (fatal) throw fatal;
      if (msg.opcode === 0x1) {
        const { headers, body } = parseTextHeaders(msg.payload.toString("utf-8"));
        const path = headers["Path"];
        if (path === "audio.metadata") {
          try {
            const meta = JSON.parse(body);
            for (const item of meta?.Metadata ?? []) {
              if (item?.Type === "SentenceBoundary" && item?.Data) {
                const start = Number(item.Data.Offset) / 1e7;
                const dur = Number(item.Data.Duration) / 1e7;
                const txt = String(item.Data?.text?.Text ?? "").trim();
                if (txt && isFinite(start) && isFinite(dur)) {
                  cues.push({ start, end: start + dur, text: txt });
                }
              }
            }
          } catch { /* ignore malformed metadata */ }
        } else if (path === "turn.end") {
          break;
        }
        // "turn.start" / "response" are informational.
      } else if (msg.opcode === 0x2) {
        const audio = parseBinaryAudio(msg.payload);
        if (audio) audioParts.push(audio);
      }
    }

    if (audioParts.length === 0) throw new Error("No audio received from Edge TTS");
    return { audio: Buffer.concat(audioParts), cues };
  } finally {
    try { sock.destroy(); } catch { /* ignore */ }
  }
}

/** Resolve voice/rate/pitch from the desktop app's language+style tables. */
export function resolveEdgeParams(
  lang: string,
  voice: "male" | "female",
  style: string,
  ratePct?: number,
  pitchHz?: number,
  pauseSec?: number,
): { voiceName: string; rate: string; pitch: string; pause: number } {
  const L = EDGE_LANGUAGES[lang] ?? EDGE_LANGUAGES.en;
  const S = EDGE_STYLES[style] ?? EDGE_STYLES.normal;
  const voiceName = L.voices[voice] ?? L.voices.male;
  const r = ratePct === undefined ? S.rate : Math.round(ratePct);
  const p = pitchHz === undefined ? Math.round(S.pitch * L.pitchScale) : Math.round(pitchHz);
  const fmtSigned = (v: number, suffix: string) => `${v >= 0 ? "+" : ""}${v}${suffix}`;
  return {
    voiceName,
    rate: fmtSigned(r, "%"),
    pitch: fmtSigned(p, "Hz"),
    pause: pauseSec === undefined ? S.pause : Math.min(3, Math.max(0, pauseSec)),
  };
}
