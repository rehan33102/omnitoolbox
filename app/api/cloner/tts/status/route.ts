import { NextRequest, NextResponse } from "next/server";
import { clonerFetch, readBackendJson, ClonerOffline } from "@/lib/cloner";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const JOB_ID_RE = /^[a-f0-9]{12}$/;

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

type NormalState = "queued" | "running" | "done" | "error";

/**
 * GET /api/cloner/tts/status?jobId=… — polls the clone engine's render job.
 * Returns { state: "queued" | "running" | "done" | "error", error?, eta_s?, elapsed_s? }.
 * Never fakes audio: 503 { error:"cloner_offline" } when the backend is down,
 * 404 { error:"job_not_found" } for an unknown job.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`cloner:tts:status:${clientIp(req)}`, 120, 60 * 1000)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests — please try again later." },
      { status: 429 }
    );
  }

  const jobId = (req.nextUrl.searchParams.get("jobId") || "").trim();
  if (!JOB_ID_RE.test(jobId)) {
    return NextResponse.json({ error: "bad_request", message: "Unknown render job." }, { status: 400 });
  }

  try {
    const res = await clonerFetch(`/api/jobs/${jobId}`);
    if (res.status === 404) {
      return NextResponse.json({ error: "job_not_found", message: "This render job is gone." }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: "tts_failed", message: "Could not check the render status — please try again." },
        { status: 502 }
      );
    }
    const data = await readBackendJson(res);
    const raw = typeof data.status === "string" ? data.status : "";
    let state: NormalState;
    let error: string | undefined;
    if (raw === "queued" || raw === "running") {
      state = raw;
    } else if (raw === "done") {
      state = "done";
    } else if (raw === "error" || raw === "cancelled") {
      state = "error";
      error = typeof data.error === "string" && data.error ? data.error : "Voice generation failed — please try again.";
    } else {
      return NextResponse.json({ error: "tts_failed", message: "Unknown render state." }, { status: 502 });
    }
    const out: Record<string, unknown> = { state };
    if (error) out.error = error;
    if (typeof data.eta_s === "number") out.eta_s = data.eta_s;
    if (typeof data.elapsed_s === "number") out.elapsed_s = data.elapsed_s;
    if (typeof data.chunks_done === "number") out.chunks_done = data.chunks_done;
    if (typeof data.chunks_total === "number") out.chunks_total = data.chunks_total;
    return NextResponse.json(out);
  } catch (err) {
    if (err instanceof ClonerOffline) {
      return NextResponse.json({ error: "cloner_offline" }, { status: 503 });
    }
    return NextResponse.json(
      { error: "tts_failed", message: "Could not check the render status — please try again." },
      { status: 502 }
    );
  }
}
