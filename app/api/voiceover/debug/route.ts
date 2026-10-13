import { NextResponse } from "next/server";
import { edgeTtsWs } from "@/lib/edge-tts-ws";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const buf = await edgeTtsWs("Hola, esto es una prueba.", {
      voice: "es-ES-AlvaroNeural",
    });
    return NextResponse.json({ ok: true, bytes: buf.length });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
