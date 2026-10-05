import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { EDGE_LANGUAGES, EDGE_STYLES } from "@/lib/edge-tts";

export async function GET() {
  const edgeLanguages = Object.entries(EDGE_LANGUAGES).map(([code, l]) => ({
    code,
    label: l.label,
    flag: l.flag,
  }));
  const edgeStyles = Object.entries(EDGE_STYLES).map(([key, s]) => ({
    key,
    label: s.label,
  }));
  return NextResponse.json({
    // Edge TTS (Microsoft neural) is the engine — free, no key, user's own tool approach.
    provider: "edge",
    edge: { languages: edgeLanguages, styles: edgeStyles },
    voices: [],
  });
}
