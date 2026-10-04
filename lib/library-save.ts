"use client";

import { saveBlob } from "@/lib/db";
import { saveToCloud } from "@/lib/cloud-library";

/**
 * Save a generated file to the user's library — ALWAYS saves locally,
 * and also uploads to cloud if the user is signed in.
 *
 * This is the single function every tool should call when the user
 * creates something. "Jo bhi banaye, library mein save ho!"
 */
export async function saveToLibrary(
  kind: "voiceover" | "qr" | "image" | "pdf" | "video",
  blob: Blob,
  name: string,
  meta?: Record<string, unknown>
): Promise<string | null> {
  // 1. Always save locally (IndexedDB) — works offline, instant
  let id: string | null = null;
  try {
    id = await saveBlob(kind, blob, name, meta);
  } catch (e) {
    console.warn("[library] local save failed:", e);
  }

  // 2. Also save to cloud if signed in — best effort, never blocks UX
  try {
    const result = await saveToCloud(blob, kind, name);
    if (!result.ok && result.reason !== "signin") {
      console.warn("[library] cloud save failed:", result.reason);
    }
  } catch (e) {
    console.warn("[library] cloud save error:", e);
  }

  return id;
}
