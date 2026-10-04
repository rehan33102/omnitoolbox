import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const JOB_RE = /^[a-f0-9]{32}$/;

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const { jobId } = params;
  if (!JOB_RE.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
  }
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".video-jobs", `${jobId}.json`), "utf8");
    const job = JSON.parse(raw);
    return NextResponse.json({
      status: job.status ?? "unknown",
      progress: job.progress ?? 0,
      step: job.step ?? "",
      elapsedSec: job.elapsedSec ?? 0,
      estimatedSecTotal: job.estimatedSecTotal ?? null,
      startedAt: job.startedAt ?? job.createdAt ?? null,
      videoUrl: job.videoUrl ?? null,
      durationSec: job.durationSec ?? null,
      error: job.error ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
}
