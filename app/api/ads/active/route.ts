import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { AD_DEFAULTS } from "@/lib/ad-options";
import { adScheduleActive } from "@/lib/ad-targeting";
import type { SiteAd } from "@/lib/ad-schema";

// Must be dynamic: this feed reflects live admin changes. A static
// prerender would bake the build-time (empty) result forever.
/** @public */
export const dynamic = "force-dynamic";

// Disable Next.js Data Cache: supabase-js uses fetch() internally and Next
// would otherwise cache those DB queries, serving stale rows.
export const fetchCache = "force-no-store";

/**
 * GET /api/ads/active — public feed of enabled popup ads for the AdPopup
 * client component. No auth.
 *
 * Caching: NONE (no-store). This feed must reflect admin deletes/disables
 * immediately — a deleted ad must never be served again. The payload is tiny;
 * freshness beats the few ms a cache would save.
 *
 * Schedule windows are enforced here server-side (out-of-range ads are
 * filtered out); the client re-checks as belt-and-suspenders.
 */
const KEY = "site_ads";

export async function GET() {
  // Uses the exact same getKV query as the admin site-ads API so public
  // and admin can never disagree on the current ads.
  const now = Date.now();
  const all = await getKV<SiteAd[]>(KEY, []);
  const ads = all
    .filter(
      (a) =>
        a &&
        a.enabled &&
        adScheduleActive(a.scheduleStart, a.scheduleEnd, now)
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
      linkUrl: a.linkUrl,
      animation: a.animation,
      durationSec: a.durationSec,
      pages: a.pages ?? [],
      // Per-ad options — `??` keeps ads saved before these existed
      // behaving exactly as before.
      showDelaySec: a.showDelaySec ?? AD_DEFAULTS.showDelaySec,
      frequency: a.frequency ?? AD_DEFAULTS.frequency,
      position: a.position ?? AD_DEFAULTS.position,
      backdrop: a.backdrop ?? AD_DEFAULTS.backdrop,
      closeDelaySec: a.closeDelaySec ?? AD_DEFAULTS.closeDelaySec,
      devices: a.devices ?? AD_DEFAULTS.devices,
      scheduleStart: a.scheduleStart ?? null,
      scheduleEnd: a.scheduleEnd ?? null,
    }));
  return NextResponse.json(
    { ads },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}
