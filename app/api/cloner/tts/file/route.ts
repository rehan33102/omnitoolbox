import { NextRequest, NextResponse } from "next/server";
import { clonerFetch, readBackendJson, ClonerOffline } from "@/lib/cloner";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const JOB_ID_RE = /^[a-f0-9]{12}$/;

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/**
 * GET /api/cloner/tts/file?jobId=… — downloads the finished render as MP3.
 * 409 { error:"job_not_ready" } while the job is still queued/running,
 * 503 { error:"cloner_offline" } when the backend is down. The download
 * filename is ours ("voice-clone.mp3") — the engine's internal name is not exposed.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`cloner:tts:file:${clientIp(req)}`, 30, 60 * 1000)) {
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
    // Fast readiness check before pulling the (potentially large) file.
    const st = await clonerFetch(`/api/jobs/${jobId}`);
    if (st.status === 404) {
      return NextResponse.json({ error: "job_not_found", message: "This render job is gone." }, { status: 404 });
    }
    if (!st.ok) {
      return NextResponse.json(
        { error: "tts_failed", message: "Could not fetch the finished audio." },
        { status: 502 }
      );
    }
    const sdata = await readBackendJson(st);
    const status = typeof sdata.status === "string" ? sdata.status : "";
    if (status !== "done") {
      if (status === "error" || status === "cancelled") {
        return NextResponse.json(
          {
            error: "tts_failed",
            message:
              typeof sdata.error === "string" && sdata.error
                ? sdata.error
                : "Voice generation failed — please try again.",
          },
          { status: 502 }
        );
      }
      return NextResponse.json({ error: "job_not_ready", message: "Still rendering — please wait." }, { status: 409 });
    }

    const res = await clonerFetch(`/api/jobs/${jobId}/file/output.mp3`);
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || !contentType.startsWith("audio/")) {
      return NextResponse.json(
        { error: "tts_failed", message: "Could not fetch the finished audio." },
        { status: 502 }
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) {
      return NextResponse.json({ error: "tts_failed", message: "The voice came back empty." }, { status: 502 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "content-disposition": 'attachment; filename="voice-clone.mp3"',
        "content-length": String(buf.length),
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ClonerOffline) {
      return NextResponse.json({ error: "cloner_offline" }, { status: 503 });
    }
    return NextResponse.json(
      { error: "tts_failed", message: "Could not fetch the finished audio." },
      { status: 502 }
    );
  }
}
