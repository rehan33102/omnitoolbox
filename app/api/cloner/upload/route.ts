import { NextRequest, NextResponse } from "next/server";
import { clonerFetch, readBackendJson, ClonerOffline } from "@/lib/cloner";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — plenty for a 6–30s sample
const ALLOWED_PREFIXES = ["audio/", "video/"];

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/**
 * POST /api/cloner/upload — accepts a multipart voice sample from the browser
 * and forwards it to the cloner backend's POST /api/record/upload.
 * Returns the backend JSON: { path: "data/uploads/rec_….wav", duration_s }.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`cloner:upload:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many uploads — please try again later." },
      { status: 429 }
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "bad_request", message: "No file received." }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "bad_request", message: "Choose an audio file first." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "The sample must be under 25 MB." },
      { status: 400 }
    );
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_PREFIXES.some((p) => mime.startsWith(p))) {
    return NextResponse.json(
      { error: "bad_type", message: "Please upload an audio file." },
      { status: 400 }
    );
  }

  try {
    const fd = new FormData();
    fd.append("file", file, file.name || "sample.wav");
    const res = await clonerFetch("/api/record/upload", { method: "POST", body: fd });
    const data = await readBackendJson(res);
    if (!res.ok) {
      const msg = typeof data.detail === "string" ? data.detail : "The voice sample could not be processed.";
      return NextResponse.json({ error: "upload_rejected", message: msg }, { status: 422 });
    }
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ClonerOffline) {
      return NextResponse.json({ error: "cloner_offline" }, { status: 503 });
    }
    return NextResponse.json(
      { error: "upload_failed", message: "Upload failed — please try again." },
      { status: 502 }
    );
  }
}
