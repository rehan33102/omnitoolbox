import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { getKV, setKV, deleteKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";
import { PAGE_TARGETS } from "@/lib/ad-pages";
import { makeAdSchemas, type SiteAd } from "@/lib/ad-schema";

export type { SiteAd };

const KEY = "site_ads";
const VALID_PATHS = new Set(PAGE_TARGETS.map((p) => p.path));

// Schemas live in lib/ad-schema.ts so the public feed can never disagree
// with the admin API on validation or option sets.
const { adSchema, patchSchema } = makeAdSchemas(VALID_PATHS);

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
  // Verify-after-write: the update (e.g. disable) must be visible on re-read,
  // otherwise the public feed could keep serving a disabled ad.
  const after = await readAll();
  const check = after.find((a) => a.id === id);
  if (!check || ("enabled" in updates && check.enabled !== updates.enabled)) {
    return NextResponse.json(
      { error: "Update did not persist" },
      { status: 500 }
    );
  }
  const changed = Object.keys(updates).join(", ");
  await logActivity("ad.updated", `Popup ad "${ads[idx].name}" updated (${changed || "no changes"})`);
  return NextResponse.json({ ok: true, ad: ads[idx] });
}

/** DELETE — remove a popup ad by ?id=. Verifies the id is really gone
 * afterwards: a "success" that still serves the ad publicly is worse than
 * an honest failure. */
export async function DELETE(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ads = await readAll();
  const idx = ads.findIndex((a) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  const [removed] = ads.splice(idx, 1);
  // Empty list: remove the key entirely instead of storing [].
  const saved = ads.length === 0 ? await deleteKV(KEY) : await setKV(KEY, ads);
  if (!saved) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  // Verify-after-write: re-read and confirm the deleted ad is really gone.
  const after = await readAll();
  if (after.some((a) => a.id === id)) {
    return NextResponse.json(
      { error: "Delete did not persist — ad still present" },
      { status: 500 }
    );
  }
  await logActivity("ad.deleted", `Popup ad "${removed?.name ?? id}" deleted`);
  return NextResponse.json({ ok: true, deleted: id });
}
