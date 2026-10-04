#!/usr/bin/env node
/**
 * Video Generator Worker — runs on persistent VM.
 * Polls Supabase video_jobs table for queued jobs, processes them,
 * uploads result to Supabase Storage, updates job status.
 *
 * Run via cron every minute: * * * * * /usr/bin/node /home/hatch/workspace/omnitoolbox/scripts/video-queue-worker.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { execSync, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const WORKER_SCRIPT = "/home/hatch/workspace/omnitoolbox/scripts/video-worker.mjs";
const OUTPUT_DIR = "/home/hatch/workspace/omnitoolbox/public/videos/generated";

async function updateJob(id, fields) {
  await supabase.from("video_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
}

async function processJob(job) {
  const { id, params } = job;
  console.log(`[worker] Processing job ${id}`);
  const startTime = Date.now();

  try {
    await updateJob(id, { status: "processing", step: "Starting…", progress: 1 });

    // Write params to a temp job file for the existing worker script
    const jobsDir = "/home/hatch/workspace/omnitoolbox/.video-jobs";
    await fs.mkdir(jobsDir, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const jobFile = path.join(jobsDir, `${id}.json`);
    await fs.writeFile(jobFile, JSON.stringify({
      jobId: id,
      status: "processing",
      progress: 1,
      step: "Starting…",
      elapsedSec: 0,
      estimatedSecTotal: job.estimated_sec_total,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      params,
    }));

    // Progress reporter: watch the job file and sync to Supabase
    let lastProgress = 0;
    const reporter = setInterval(async () => {
      try {
        const data = JSON.parse(await fs.readFile(jobFile, "utf-8"));
        if (data.progress !== lastProgress || data.step) {
          lastProgress = data.progress;
          await updateJob(id, {
            progress: data.progress || 0,
            step: data.step || "Processing…",
            elapsed_sec: Math.floor((Date.now() - startTime) / 1000),
          });
        }
      } catch {}
    }, 5000);

    // Run the existing worker script
    const result = spawnSync("node", [WORKER_SCRIPT, id], {
      cwd: "/home/hatch/workspace/omnitoolbox",
      timeout: 30 * 60 * 1000, // 30 min max
      stdio: "pipe",
    });

    clearInterval(reporter);

    // Check result
    const finalData = JSON.parse(await fs.readFile(jobFile, "utf-8").catch(() => "{}"));

    if (result.status === 0 && finalData.status === "done") {
      // Upload to Supabase Storage
      const videoPath = path.join(OUTPUT_DIR, `${id}.mp4`);
      const videoBuffer = await fs.readFile(videoPath);

      const storagePath = `generated/${id}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from("user-library")
        .upload(storagePath, videoBuffer, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      // Get public URL (or signed URL)
      const { data: urlData } = supabase.storage.from("user-library").getPublicUrl(storagePath);

      await updateJob(id, {
        status: "done",
        progress: 100,
        step: "Complete!",
        video_url: urlData.publicUrl,
        duration_sec: finalData.durationSec || null,
        elapsed_sec: Math.floor((Date.now() - startTime) / 1000),
      });

      console.log(`[worker] Job ${id} done: ${urlData.publicUrl}`);
    } else {
      throw new Error(finalData.error || `Worker exited with code ${result.status}`);
    }
  } catch (e) {
    console.error(`[worker] Job ${id} failed:`, e.message);
    await updateJob(id, {
      status: "failed",
      step: "Failed",
      error: e.message,
    });
  }
}

async function main() {
  // Claim one queued job (oldest first)
  const { data: jobs } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!jobs || jobs.length === 0) {
    // No work
    return;
  }

  const job = jobs[0];

  // Try to claim it (optimistic locking)
  const { data: claimed } = await supabase
    .from("video_jobs")
    .update({ status: "processing", step: "Claimed by worker…" })
    .eq("id", job.id)
    .eq("status", "queued")
    .select();

  if (!claimed || claimed.length === 0) {
    // Someone else claimed it
    return;
  }

  await processJob(job);
}

main().catch((e) => {
  console.error("[worker] Fatal:", e);
  process.exit(1);
});
