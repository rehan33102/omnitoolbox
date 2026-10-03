/* Shared background-removal engine: fast server API first, on-device AI fallback.
 * Used by BackgroundRemover and BackgroundStudio. The heavy model loads once
 * per page lifetime (module-level cache).
 */

"use client";

export type ProgressCb = (key: string, current: number, total: number) => void;
export type RemoveFn = (image: Blob, config?: Record<string, unknown>) => Promise<Blob>;

const CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm",
  "https://esm.sh/@imgly/background-removal@1.5.5",
];

const ENGINE_TIMEOUT_MS = 150_000;

let enginePromise: Promise<RemoveFn> | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Engine load timed out")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export async function loadBgEngine(onProgress: ProgressCb): Promise<RemoveFn> {
  if (!enginePromise) {
    enginePromise = (async () => {
      let lastErr: unknown = null;
      for (const url of CDN_URLS) {
        try {
          const mod = (await withTimeout(
            import(/* webpackIgnore: true */ url),
            45_000
          )) as { removeBackground: RemoveFn };
          const removeBackground = mod.removeBackground;
          const config: Record<string, unknown> = {
            model: "isnet_quint8",
            output: { format: "image/png", quality: 0.9 },
            progress: onProgress,
          };
          try {
            const c = document.createElement("canvas");
            c.width = 32; c.height = 32;
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, 32, 32);
              const tiny = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
              if (tiny) await withTimeout(removeBackground(tiny, config), ENGINE_TIMEOUT_MS);
            }
          } catch { /* warm-up output doesn't matter */ }
          const wrapped: RemoveFn = (image, extra) =>
            withTimeout(
              removeBackground(image, { ...config, progress: onProgress, ...(extra ?? {}) }),
              ENGINE_TIMEOUT_MS
            );
          return wrapped;
        } catch (e) {
          lastErr = e;
        }
      }
      enginePromise = null;
      throw lastErr instanceof Error ? lastErr : new Error("AI engine failed to load");
    })();
  }
  return enginePromise;
}

/** Shrink large photos before AI runs — 3-5x faster on phones. */
export async function downscaleImage(file: Blob, maxDim = 1024): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) { bitmap.close(); return file; }
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext("2d")?.drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    return out ?? file;
  } catch {
    return file;
  }
}

/**
 * Remove background: tries the fast server API first (no big download on
 * the phone), falls back to on-device AI. Returns transparent PNG blob.
 */
export async function removeBackgroundSmart(
  file: Blob,
  onProgress: ProgressCb,
  ensureEngine: () => Promise<RemoveFn>,
): Promise<Blob> {
  // 1) Fast server
  try {
    const small = await downscaleImage(file, 1568);
    const fd = new FormData();
    fd.append("image", small, "image.png");
    const res = await fetch("/api/bg-remove", { method: "POST", body: fd });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 1000) return new Blob([buf], { type: "image/png" });
    }
  } catch { /* fall through */ }
  // 2) On-device AI
  const fn = await ensureEngine();
  const small = await downscaleImage(file, 1024);
  return fn(small);
}
