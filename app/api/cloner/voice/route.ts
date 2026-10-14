import { NextRequest, NextResponse } from "next/server";
import { clonerFetch, readBackendJson, ClonerOffline } from "@/lib/cloner";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

/** Backend reference-path shape: data/uploads/rec_<8 hex>_<name>.wav (never absolute). */
const REF_PATH_RE = /^data\/uploads\/rec_[0-9a-f]{8}_[^/\\]+\.(wav|mp3|m4a|webm|ogg|aac|flac)$/i;

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/**
 * POST /api/cloner/voice — JSON { name, ref_path, consent }.
 * Creates an instant zero-shot voice on the cloner backend (language "en").
 * Requires explicit consent; returns { voice_id }.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`cloner:voice:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many voices — please try again later." },
      { status: 429 }
    );
  }

  let body: { name?: unknown; ref_path?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const refPath = typeof body.ref_path === "string" ? body.ref_path.trim() : "";
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "consent_required", message: "Please confirm this is your own voice or you have permission to clone it." },
      { status: 400 }
    );
  }
  if (name.length < 1) {
    return NextResponse.json({ error: "bad_request", message: "Give the voice a name." }, { status: 400 });
  }
  if (!REF_PATH_RE.test(refPath)) {
    return NextResponse.json({ error: "bad_request", message: "The voice sample path is invalid." }, { status: 400 });
  }

  try {
    const res = await clonerFetch("/api/voices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        language: "en",
        mode: "instant",
        engine_id: "gptsovits",
        ref_path: refPath,
        consent: true,
      }),
    });
    const data = await readBackendJson(res);
    if (!res.ok || typeof data.id !== "string") {
      const msg = typeof data.detail === "string" ? data.detail : "The voice could not be created.";
      return NextResponse.json({ error: "voice_failed", message: msg }, { status: 502 });
    }
    return NextResponse.json({ voice_id: data.id });
  } catch (err) {
    if (err instanceof ClonerOffline) {
      return NextResponse.json({ error: "cloner_offline" }, { status: 503 });
    }
    return NextResponse.json(
      { error: "voice_failed", message: "Voice creation failed — please try again." },
      { status: 502 }
    );
  }
}
