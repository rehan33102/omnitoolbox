/**
 * Video Shorts Studio — pure helpers (Node-testable, no DOM).
 * Turns a horizontal video into a vertical short: crop math, caption timing.
 */

export type RatioId = "9:16" | "1:1" | "4:5";

export interface RatioPreset {
  id: RatioId;
  label: string;
  hint: string;
  /** output pixels at 720p tier */
  w: number;
  h: number;
}

export const RATIOS: RatioPreset[] = [
  { id: "9:16", label: "9:16 Vertical", hint: "TikTok · Reels · Shorts", w: 720, h: 1280 },
  { id: "1:1", label: "1:1 Square", hint: "Feed posts", w: 720, h: 720 },
  { id: "4:5", label: "4:5 Portrait", hint: "Feed portrait", w: 720, h: 900 },
];

export function ratioById(id: RatioId): RatioPreset {
  return RATIOS.find((r) => r.id === id) ?? RATIOS[0];
}

/** Output canvas size for a ratio + quality tier. */
export function outputSize(ratio: RatioId, quality: "720p" | "1080p"): { w: number; h: number } {
  const r = ratioById(ratio);
  if (quality === "1080p") {
    const scale = 1080 / r.w;
    return { w: Math.round(r.w * scale), h: Math.round(r.h * scale) };
  }
  return { w: r.w, h: r.h };
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Crop window inside the source video for the target aspect.
 * frameX/frameY (0..1) place the window inside the free range
 * (0 = left/top, 0.5 = centered, 1 = right/bottom).
 */
export function computeCrop(
  srcW: number,
  srcH: number,
  ratio: RatioId,
  frameX: number,
  frameY: number,
): CropRect {
  const fx = Math.min(1, Math.max(0, frameX));
  const fy = Math.min(1, Math.max(0, frameY));
  const r = ratioById(ratio);
  const targetAspect = r.w / r.h;
  const srcAspect = srcW / srcH;
  if (srcAspect >= targetAspect) {
    // Source is wider: crop the width, keep full height.
    const sw = srcH * targetAspect;
    return { sx: fx * (srcW - sw), sy: 0, sw, sh: srcH };
  }
  // Source is taller: crop the height, keep full width.
  const sh = srcW / targetAspect;
  return { sx: 0, sy: fy * (srcH - sh), sw: srcW, sh };
}

/** Pointer drag (px on the preview canvas) -> frame delta. */
export function dragToFrameDelta(
  dxPx: number,
  dyPx: number,
  canvasW: number,
  canvasH: number,
  crop: CropRect,
  srcW: number,
  srcH: number,
): { dx: number; dy: number } {
  const scaleX = crop.sw / canvasW;
  const scaleY = crop.sh / canvasH;
  const freeX = Math.max(0, srcW - crop.sw);
  const freeY = Math.max(0, srcH - crop.sh);
  return {
    dx: freeX > 0 ? (dxPx * scaleX) / freeX : 0,
    dy: freeY > 0 ? (dyPx * scaleY) / freeY : 0,
  };
}

export interface CaptionLine {
  text: string;
  words: string[];
  start: number;
  end: number;
}

/** Split caption text (one phrase per line) into equal time slices. */
export function buildCaptionTimeline(text: string, start: number, end: number): CaptionLine[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0 || end <= start) return [];
  const slice = (end - start) / lines.length;
  return lines.map((line, i) => ({
    text: line,
    words: line.split(/\s+/).filter(Boolean),
    start: start + i * slice,
    end: start + (i + 1) * slice,
  }));
}

/** Index of the active word in a line at time t (-1 when outside the line). */
export function activeWordAt(line: CaptionLine, t: number): number {
  if (t < line.start || t >= line.end || line.words.length === 0) return -1;
  const wordDur = (line.end - line.start) / line.words.length;
  return Math.min(line.words.length - 1, Math.floor((t - line.start) / wordDur));
}

/** The caption line active at time t, if any. */
export function activeLineAt(lines: CaptionLine[], t: number): CaptionLine | null {
  for (const line of lines) {
    if (t >= line.start && t < line.end) return line;
  }
  return null;
}

/** Wrap words into rows that fit maxWidth (measure with a canvas-like fn). */
export function wrapWords(
  words: string[],
  maxWidth: number,
  measure: (s: string) => number,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  for (const word of words) {
    const trial = [...row, word].join(" ");
    if (row.length > 0 && measure(trial) > maxWidth) {
      rows.push(row);
      row = [word];
    } else {
      row = [...row, word];
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

export function formatTime(s: number): string {
  const v = Math.max(0, s);
  const m = Math.floor(v / 60);
  const sec = Math.floor(v % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function exportFileName(ratio: RatioId, stamp: number): string {
  return `shorts-${ratio.replace(":", "x")}-${stamp}.webm`;
}
