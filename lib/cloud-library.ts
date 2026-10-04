"use client";

/**
 * Upload a Blob to the signed-in user's cloud library.
 * Returns true on success, false if not signed in or upload failed.
 */
export async function saveToCloud(
  blob: Blob,
  kind: "voiceover" | "qr" | "image" | "pdf" | "video",
  name: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const form = new FormData();
    form.append("file", blob, name);
    form.append("kind", kind);
    form.append("name", name);

    const res = await fetch("/api/library", {
      method: "POST",
      body: form,
    });

    if (res.status === 401) {
      return { ok: false, reason: "signin" };
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, reason: j.error || "upload_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
