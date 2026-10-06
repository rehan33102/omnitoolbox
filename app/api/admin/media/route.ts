import { NextRequest, NextResponse } from "next/server";
import { getKV, setKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";

/**
 * GET/POST/DELETE /api/admin/media — admin media library.
 * Persistence: KV `media_library` on the seo_settings table.
 * Items: { id, name, url, size, kind ("upload"|"url"), createdAt } — newest first.
 * Files are stored as data URLs (max 2MB, image extensions only).
 */
export interface MediaItem {
  id: string;
  name: string;
  url: string;
  size: number; // bytes (file size for uploads, 0 for remote URLs)
  kind: "upload" | "url";
  createdAt: string;
}

const KEY = "media_library";
const MAX_ITEMS = 200;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

async function guard(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:media", max: 30 });
  if (sec) return sec;
  const admin = await requirePermission("media");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** GET — list media items, newest first. */
export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const items = await getKV<MediaItem[]>(KEY, []);
  return NextResponse.json({ items });
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "";
}

function nameFromUrl(url: string): string {
  try {
    const p = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "image";
    return decodeURIComponent(p).slice(0, 120) || "image";
  } catch {
    return "image";
  }
}

async function store(item: MediaItem, actor: string) {
  const items = await getKV<MediaItem[]>(KEY, []);
  items.unshift(item);
  const ok = await setKV(KEY, items.slice(0, MAX_ITEMS));
  if (ok) await logActivity("media.uploaded", `Media added: "${item.name}"`, actor);
  return ok;
}

/**
 * POST — two modes:
 *   1. multipart/form-data with a `file` field (image ≤ 2MB → stored as data URL)
 *   2. JSON { url, name? } (remote image URL — must be http/https)
 */
export async function POST(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const admin = await requirePermission("media");
  const actor = admin?.email ?? "admin";

  const contentType = req.headers.get("content-type") ?? "";
  let item: MediaItem | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    const ext = extOf(file.name);
    if (!IMAGE_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported image type. Allowed: ${IMAGE_EXTS.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;
    item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name.slice(0, 120),
      url: `data:${mime};base64,${buf.toString("base64")}`,
      size: file.size,
      kind: "upload",
      createdAt: new Date().toISOString(),
    };
  } else {
    const body = await req.json().catch(() => ({}));
    const url = String(body.url ?? "").trim();
    const name = String(body.name ?? "").trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      return NextResponse.json({ error: "url must be a valid http(s) URL" }, { status: 400 });
    }
    if (url.length > 2000) {
      return NextResponse.json({ error: "URL too long" }, { status: 400 });
    }
    item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: (name || nameFromUrl(url)).slice(0, 120),
      url,
      size: 0,
      kind: "url",
      createdAt: new Date().toISOString(),
    };
  }

  if (!(await store(item, actor))) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json({ item }, { status: 201 });
}

/** DELETE ?id= — remove an item. */
export async function DELETE(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const admin = await requirePermission("media");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const items = await getKV<MediaItem[]>(KEY, []);
  const target = items.find((i) => i.id === id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await setKV(KEY, items.filter((i) => i.id !== id)))) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  await logActivity("media.deleted", `Media removed: "${target.name}"`, admin?.email ?? "admin");
  return NextResponse.json({ ok: true });
}
