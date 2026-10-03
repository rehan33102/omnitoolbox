import { NextResponse } from "next/server";
import { EDGE_LANGUAGES, EDGE_STYLES } from "@/lib/edge-tts";

// Curated ElevenLabs voices (multilingual model speaks 32 languages incl. Urdu).
const ELEVEN_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "Female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "Female" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", gender: "Female" },
  { id: "XB0fDUnXU5powFXBwrU", name: "Charlotte", gender: "Female" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "Male" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", gender: "Male" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "Male" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "Male" },
];

export async function GET() {
  const premium = Boolean(process.env.ELEVENLABS_API_KEY);
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
    // "edge" is the primary free engine; "elevenlabs" unlocks premium voices.
    provider: premium ? "elevenlabs" : "edge",
    edge: { languages: edgeLanguages, styles: edgeStyles },
    voices: premium ? ELEVEN_VOICES : [],
  });
}
