import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { getKV, setKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";
import { PAGE_TARGETS } from "@/lib/ad-pages";

const KEY = "site_ads";
const VALID_PATHS = new Set(PAGE_TARGETS.map((p) => p.path));

export interface SiteAd {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  animation: "fade" | "slide-up" | "slide-in-right" | "zoom" | "bounce";
  durationSec: number;
  pages: string[];
  enabled: boolean;
  createdAt: string;
}

const httpUrl = z
  .string()
  .min(1, "Required")
  .refine((s) => /^https?:\/\/.+/.test(s), { message: "Must be an http(s) URL" });

const imageUrlSchema = z
  .string()
  .min(1, "Required")
  .max(2 * 1024 * 1024, "Image too large (max ~2MB)")
  .refine(
    (s) => /^https?:\/\/.+/.test(s) || /^data:image\/[a-zA-Z+]+;base64,/.test(s),
    { message: "Must be an http(s) URL or an image data URL" }
  );

const adSchema = z.object({
  name: z.string().min(1, "Name required").max(80),
  imageUrl: imageUrlSchema,
  linkUrl: httpUrl,
  animation: z.enum(["fade", "slide-up", "slide-in-right", "zoom", "bounce"]),
  durationSec: z.number().int().min(5).max(600),
  pages: z
    .array(z.string())
    .refine((arr) => arr.every((p) => VALID_PATHS.has(p)), { message: "Invalid page target" }),
  enabled: z.boolean(),
});

const patchSchema = adSchema.partial().extend({ id: z.string().min(1) });

async function guard(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:site-ads", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("monetization"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

async function readAll(): Promise<SiteAd[]> {
  const ads = await getKV<SiteAd[]>(KEY, []);
  return Array.isArray(ads) ? ads : [];
}

/** GET — list all popup ads (newest first). */
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({ ads: await readAll() });
}

/** POST — create a popup ad. */
export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = adSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  const ads = await readAll();
  const ad: SiteAd = {
    id: crypto.randomUUID(),
    ...parsed.data,
    createdAt: new Date().toISOString(),
  };
  ads.unshift(ad);
  if (!(await setKV(KEY, ads))) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  await logActivity("ad.created", `Popup ad "${ad.name}" created`);
  return NextResponse.json({ ok: true, ad });
}

/** PATCH — toggle enabled or edit fields. */
export async function PATCH(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  const { id, ...updates } = parsed.data;
  const ads = await readAll();
  const idx = ads.findIndex((a) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  ads[idx] = { ...ads[idx], ...updates };
  if (!(await setKV(KEY, ads))) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  const changed = Object.keys(updates).join(", ");
  await logActivity("ad.updated", `Popup ad "${ads[idx].name}" updated (${changed || "no changes"})`);
  return NextResponse.json({ ok: true, ad: ads[idx] });
}

/** DELETE — remove a popup ad by ?id=. */
export async function DELETE(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ads = await readAll();
  const idx = ads.findIndex((a) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  const [removed] = ads.splice(idx, 1);
  if (!(await setKV(KEY, ads))) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  await logActivity("ad.deleted", `Popup ad "${removed?.name ?? id}" deleted`);
  return NextResponse.json({ ok: true, deleted: id });
}
