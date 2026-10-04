#!/usr/bin/env node
/**
 * video-worker.mjs — background worker for OmniToolBox Video Generator.
 *
 * Usage: node scripts/video-worker.mjs <jobId>
 *
 * Pipeline (simple + robust):
 *   1. Read job JSON from .video-jobs/<jobId>.json
 *   2. Split script into <=500-char chunks (sentence-aware)
 *   3. TTS each chunk via the voiceover synthesize API -> chunk MP3s
 *   4. ffprobe each chunk for duration, concat audio with ffmpeg
 *   5. Visuals: Pixabay photos (if PIXABAY_API_KEY) else curated Unsplash
 *      photos per category, else generated gradient slides.
 *      Every visual gets a Ken Burns zoompan — no static slideshow feel.
 *   6. Title card (3s) + end card (3s, subscribe CTA) via drawtext
 *   7. Concat segments, loudness-normalize + mux audio -> MP4 (H.264 + AAC)
 *   8. Update job JSON: {status, progress 0-100, step, elapsedSec,
 *      estimatedSecTotal, videoUrl}. 30-minute hard timeout.
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JOBS_DIR = path.join(ROOT, ".video-jobs");
const OUT_DIR = path.join(ROOT, "public", "videos", "generated");
const TTS_URL = process.env.VIDEO_TTS_URL || "https://omnitoolbox-zeta.vercel.app/api/voiceover/synthesize";
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const JOB_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CHUNK_CHARS = 500;

const jobId = process.argv[2];
if (!jobId || !/^[a-f0-9]{32}$/.test(jobId)) {
  console.error("Invalid job id");
  process.exit(1);
}

const jobPath = path.join(JOBS_DIR, `${jobId}.json`);
const workDir = path.join(JOBS_DIR, `work-${jobId}`);
const startedAt = Date.now();
const log = (...a) => console.log(`[video-worker:${jobId}]`, ...a);
const elapsedSec = () => Math.round((Date.now() - startedAt) / 1000);

async function updateJob(patch) {
  try {
    const raw = await fs.readFile(jobPath, "utf8");
    const job = JSON.parse(raw);
    await fs.writeFile(jobPath, JSON.stringify({ ...job, ...patch, elapsedSec: elapsedSec(), updatedAt: Date.now() }));
  } catch (e) {
    log("updateJob failed:", e.message);
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts });
    let stderr = "";
    p.stderr.on("data", (d) => { stderr += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function ffprobeDuration(file) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
    let out = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => {
      const d = parseFloat(out.trim());
      if (code === 0 && isFinite(d) && d > 0) resolve(d);
      else reject(new Error(`ffprobe failed for ${file}`));
    });
  });
}

/** Split text into sentence-aware chunks <= MAX_CHUNK_CHARS. */
function chunkText(text) {
  const sentences = text.match(/[^.!?;\n]+[.!?;\n]+["'”]?|\S[^.!?;\n]*$/g) ?? [text];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    const t = s.trim();
    if (!t) continue;
    if (cur && `${cur} ${t}`.length > MAX_CHUNK_CHARS) { chunks.push(cur); cur = t; }
    else cur = cur ? `${cur} ${t}` : t;
  }
  if (cur) chunks.push(cur);
  const out = [];
  for (const c of chunks) {
    if (c.length <= MAX_CHUNK_CHARS) out.push(c);
    else for (let i = 0; i < c.length; i += MAX_CHUNK_CHARS) out.push(c.slice(i, i + MAX_CHUNK_CHARS));
  }
  return out;
}

async function ttsChunk(text, lang, voice, index) {
  const outFile = path.join(workDir, `chunk-${String(index).padStart(3, "0")}.mp3`);
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang, voice, style: "normal" }),
      });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 800) throw new Error("TTS returned empty audio");
      await fs.writeFile(outFile, buf);
      return outFile;
    } catch (e) {
      lastErr = e;
      log(`chunk ${index} TTS attempt ${attempt} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

/* ---------------- Visuals ---------------- */

/** Curated Unsplash photos per category (fallback when no Pixabay key). */
const U = (id) => `https://images.unsplash.com/${id}?w=1280&q=80&auto=format&fit=crop`;
const CATEGORY_IMAGES = {
  Finance: [
    U("photo-1611974789855-9c2a0a7236a3"), U("photo-1559526324-4b87b5e36e44"),
    U("photo-1526304640581-d334cdbbf45e"), U("photo-1553729459-efe14ef6055d"),
    U("photo-1590283603385-17ffb3a7f29f"), U("photo-1554672408-730436b60dde"),
  ],
  Technology: [
    U("photo-1518770660439-4636190af475"), U("photo-1526374965328-7f61d4dc18c5"),
    U("photo-1550751827-4bd374c3f58b"), U("photo-1486312338219-ce68d2c6f44d"),
    U("photo-1519389950473-47ba0277781c"), U("photo-1555066931-4365d14bab8c"),
  ],
  Motivation: [
    U("photo-1434030216411-0b793f4b4173"), U("photo-1499750310107-5fef28a66643"),
    U("photo-1471107340929-a87cd0f5b5f3"), U("photo-1552664730-d307ca884978"),
    U("photo-1464822759023-fed622ff2c3b"), U("photo-1506905925346-21bda4d32df4"),
  ],
  Health: [
    U("photo-1571019613454-1cb2f99b2d8b"), U("photo-1517836357463-d25dfeac3438"),
    U("photo-1544367567-0f2fcb009e0b"), U("photo-1505751172876-fa1923c5c528"),
    U("photo-1576091160399-112ba8d25d1d"), U("photo-1490645935967-10de6ba17061"),
  ],
  Education: [
    U("photo-1503676260728-1c00da094a0b"), U("photo-1523050854058-8df90110c9f1"),
    U("photo-1481627834876-b7833e8f5570"), U("photo-1456513080510-7bf3a84b82f8"),
    U("photo-1434030216411-0b793f4b4173"), U("photo-1507842217343-583bb7270b66"),
  ],
  Entertainment: [
    U("photo-1489599849927-2ee91cede3ba"), U("photo-1514525253161-7a46d19cd819"),
    U("photo-1470229722913-7c0e2dbbafd3"), U("photo-1478737270239-2f02b77fc618"),
    U("photo-1493225457124-a3eb161ffa5f"), U("photo-1516280440614-37939bbacd81"),
  ],
  News: [
    U("photo-1504711434969-e33886168f5c"), U("photo-1495020689067-958852a7765e"),
    U("photo-1585829365295-ab7cd400c167"), U("photo-1449824913935-59a10b8d2000"),
    U("photo-1495020689067-958852a7765e"), U("photo-1523995462485-3d171b5c8fa9"),
  ],
  Other: [
    U("photo-1441974231531-c6227db76b6e"), U("photo-1507525428034-b723cf961d3e"),
    U("photo-1497366216548-37526070297c"), U("photo-1501339847302-ac426a4a7cbb"),
    U("photo-1522071820081-009f0129c71c"), U("photo-1507003211169-0a1dd7228f2d"),
  ],
};

async function downloadImage(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) throw new Error(`not an image: ${ct}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10 * 1024) throw new Error("image too small");
  await fs.writeFile(dest, buf);
}

/** Try Pixabay for `count` photos; null on any failure. */
async function pixabayImages(query, count) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;
  try {
    const url = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=${Math.min(Math.max(count, 3), 20)}&safesearch=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pixabay HTTP ${res.status}`);
    const data = await res.json();
    const hits = (data.hits || []).map((h) => h.largeImageURL).filter(Boolean);
    const files = [];
    for (let i = 0; i < Math.min(hits.length, count); i++) {
      try {
        const f = path.join(workDir, `pix-${i}.jpg`);
        await downloadImage(hits[i], f);
        files.push(f);
      } catch (e) { log(`pixabay img ${i} skipped: ${e.message}`); }
    }
    return files.length ? files : null;
  } catch (e) {
    log("Pixabay failed, trying Unsplash:", e.message);
    return null;
  }
}

/** Curated Unsplash photos for the category; null if none downloadable. */
async function unsplashImages(category, count) {
  const urls = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Other;
  const files = [];
  for (let i = 0; i < count; i++) {
    const url = urls[i % urls.length];
    try {
      const f = path.join(workDir, `uns-${i}.jpg`);
      await downloadImage(url, f);
      files.push(f);
    } catch (e) { log(`unsplash img ${i} skipped: ${e.message}`); }
  }
  return files.length ? files : null;
}

/** Gradient slide PNGs — last-resort visuals (always works, offline-safe). */
async function gradientSlides(count, w, h) {
  const palettes = [
    ["0x312e81", "0xbe185d"], ["0x0c4a6e", "0x082f49"], ["0x1e1b4b", "0x0f172a"],
    ["0x7c2d12", "0x431407"], ["0x052e16", "0x14532d"], ["0x020617", "0x4c1d95"],
  ];
  const files = [];
  for (let i = 0; i < count; i++) {
    const [c0, c1] = palettes[i % palettes.length];
    const f = path.join(workDir, `slide-${String(i).padStart(3, "0")}.png`);
    await run("ffmpeg", ["-y", "-v", "error",
      "-f", "lavfi", "-i", `gradients=size=${w}x${h}:speed=0:c0=${c0}:c1=${c1}:x0=0:y0=0:x1=0:y1=${h}`,
      "-frames:v", "1", f]);
    files.push(f);
  }
  return files;
}

function escDrawtext(s) {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/\n/g, " ");
}

/** 3-second title/end card with big centered text. */
async function textCard(lines, w, h, outFile, bg = "#0f172a") {
  const [l1, l2] = lines;
  let vf = `drawtext=fontfile=${FONT}:text='${escDrawtext(l1)}':fontcolor=white:fontsize=${Math.round(w / 22)}:x=(w-text_w)/2:y=(h-text_h)/2-40`;
  if (l2) {
    vf += `,drawtext=fontfile=${FONT}:text='${escDrawtext(l2)}':fontcolor=#fbbf24:fontsize=${Math.round(w / 34)}:x=(w-text_w)/2:y=(h-text_h)/2+60`;
  }
  vf += `,format=yuv420p`;
  await run("ffmpeg", ["-y", "-v", "error",
    "-f", "lavfi", "-i", `color=c=${bg}:s=${w}x${h}:d=3:r=30`,
    "-vf", vf, "-frames:v", "90", "-c:v", "libx264", "-pix_fmt", "yuv420p", outFile]);
}

/** One Ken Burns segment: slow zoompan over the image for `dur` seconds. */
async function kenBurnsSegment(img, dur, w, h, outFile) {
  const frames = Math.max(15, Math.round(dur * 30));
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
    `zoompan=z='min(zoom+0.0012,1.12)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=30,` +
    `format=yuv420p`;
  await run("ffmpeg", ["-y", "-v", "error", "-loop", "1", "-i", img,
    "-vf", vf, "-frames:v", String(frames), "-c:v", "libx264", "-preset", "veryfast", outFile]);
}

async function main() {
  const raw = await fs.readFile(jobPath, "utf8");
  const job = JSON.parse(raw);
  const { script, title, category, resolution, voice, language } = job.params;
  const W = resolution === "1080p" ? 1920 : 1280;
  const H = resolution === "1080p" ? 1080 : 720;

  await fs.mkdir(workDir, { recursive: true });
  await fs.mkdir(OUT_DIR, { recursive: true });
  await updateJob({ status: "working", progress: 2, step: "Starting…", startedAt });

  const killer = setTimeout(async () => {
    log("TIMEOUT — marking failed");
    await updateJob({ status: "failed", error: "Generation timed out after 30 minutes." });
    process.exit(2);
  }, JOB_TIMEOUT_MS);
  killer.unref();

  try {
    // ---- 1. Chunk + TTS ----
    const chunks = chunkText(script);
    log(`${chunks.length} chunks, ${script.length} chars`);
    await updateJob({ progress: 5, step: `Generating voiceover (0/${chunks.length})…` });

    const audioFiles = [];
    const durations = [];
    for (let i = 0; i < chunks.length; i++) {
      const f = await ttsChunk(chunks[i], language, voice, i);
      audioFiles.push(f);
      durations.push(await ffprobeDuration(f));
      const pct = 5 + Math.round(((i + 1) / chunks.length) * 40);
      await updateJob({ progress: pct, step: `Generating voiceover (${i + 1}/${chunks.length})…` });
      await new Promise((r) => setTimeout(r, 300)); // be kind to the TTS endpoint
    }

    // ---- 2. Concat audio ----
    await updateJob({ progress: 48, step: "Mixing audio…" });
    const listFile = path.join(workDir, "audio-list.txt");
    await fs.writeFile(listFile, audioFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    const audioOut = path.join(workDir, "audio.mp3");
    await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", audioOut]);
    const totalAudio = durations.reduce((a, b) => a + b, 0);
    log(`total audio: ${totalAudio.toFixed(1)}s`);

    // ---- 3. Visuals (Pixabay -> Unsplash -> gradients) ----
    await updateJob({ progress: 52, step: "Preparing visuals…" });
    let images = await pixabayImages(`${category} ${title}`.slice(0, 80), chunks.length);
    if (!images) {
      log("trying curated Unsplash photos");
      images = await unsplashImages(category, chunks.length);
    }
    if (!images) {
      log("using gradient slides");
      images = await gradientSlides(chunks.length, W, H);
    }
    log(`${images.length} visuals ready`);

    // ---- 4. Segments: title card + Ken Burns per chunk + end card ----
    const segFiles = [];
    const titleSeg = path.join(workDir, "seg-title.mp4");
    await textCard([title.length > 80 ? title.slice(0, 77) + "…" : title, "Omni Tool Box"], W, H, titleSeg, "#111827");
    segFiles.push(titleSeg);

    for (let i = 0; i < chunks.length; i++) {
      const img = images[i % images.length];
      const seg = path.join(workDir, `seg-${String(i).padStart(3, "0")}.mp4`);
      await kenBurnsSegment(img, durations[i], W, H, seg);
      segFiles.push(seg);
      const pct = 52 + Math.round(((i + 1) / chunks.length) * 38);
      await updateJob({ progress: pct, step: `Rendering video (${i + 1}/${chunks.length})…` });
    }

    const endSeg = path.join(workDir, "seg-end.mp4");
    await textCard(["Thanks for watching!", "🔔 Subscribe for more  •  Omni Tool Box"], W, H, endSeg, "#1e1b4b");
    segFiles.push(endSeg);

    // ---- 5. Concat + loudness-normalized mux ----
    await updateJob({ progress: 93, step: "Finalizing video…" });
    const vlist = path.join(workDir, "video-list.txt");
    await fs.writeFile(vlist, segFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    const silentVideo = path.join(workDir, "silent.mp4");
    await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", vlist,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", silentVideo]);

    const finalName = `${jobId}.mp4`;
    const finalPath = path.join(OUT_DIR, finalName);
    // Narration starts after the 3s title card (adelay); no -shortest so the
    // full video (incl. end card) is kept — audio simply ends earlier.
    await run("ffmpeg", ["-y", "-v", "error", "-i", silentVideo, "-i", audioOut,
      "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
      "-af", "adelay=3000|3000,loudnorm=I=-16:TP=-1.5:LRA=11",
      "-movflags", "+faststart", finalPath]);

    const totalVideo = await ffprobeDuration(finalPath);
    await updateJob({
      status: "done", progress: 100, step: "Done! 🎬",
      videoUrl: `/videos/generated/${finalName}`,
      durationSec: Math.round(totalVideo),
    });
    log(`DONE -> ${finalPath} (${totalVideo.toFixed(1)}s)`);

    await fs.rm(workDir, { recursive: true, force: true });
  } catch (e) {
    log("FAILED:", e.message);
    await updateJob({ status: "failed", error: e.message || "Generation failed." });
    process.exitCode = 1;
  }
}

main();
