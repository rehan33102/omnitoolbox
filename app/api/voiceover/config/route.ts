import { NextResponse } from "next/server";

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
  return NextResponse.json({
    provider: premium ? "elevenlabs" : "google",
    voices: premium ? ELEVEN_VOICES : [],
  });
}
