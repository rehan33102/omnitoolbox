import { NextResponse } from "next/server";

const VOICES_URL =
  "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

type RawVoice = {
  ShortName?: string;
  Locale?: string;
  Gender?: string;
  FriendlyName?: string;
};

export type VoiceInfo = {
  name: string;
  locale: string;
  gender: string;
  friendlyName: string;
};

let cache: VoiceInfo[] | null = null;
let cacheAt = 0;
const CACHE_TTL = 24 * 3600 * 1000;

export async function GET() {
  try {
    if (!cache || Date.now() - cacheAt > CACHE_TTL) {
      const res = await fetch(VOICES_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 86400 },
      });
      if (!res.ok) throw new Error(`voices list HTTP ${res.status}`);
      const raw = (await res.json()) as RawVoice[];
      cache = raw
        .filter((v) => v.ShortName && v.Locale)
        .map((v) => ({
          name: v.ShortName as string,
          locale: v.Locale as string,
          gender: v.Gender ?? "Unknown",
          friendlyName: v.FriendlyName ?? (v.ShortName as string),
        }));
      cacheAt = Date.now();
    }
    return NextResponse.json({ voices: cache });
  } catch (e) {
    // Serve stale cache if the upstream hiccups.
    if (cache) return NextResponse.json({ voices: cache });
    return NextResponse.json({ error: "Could not load voices. Check your connection and retry." }, { status: 502 });
  }
}
