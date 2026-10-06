import { NextResponse } from "next/server";
import { getKVWithMeta } from "@/lib/kv";

// Must be dynamic: this feed reflects live admin changes. A static
// prerender would bake the build-time (empty) result forever.
/** @public */
export const dynamic = "force-dynamic";

/**
 * GET /api/ads/active — public feed of enabled popup ads for the AdPopup
 * client component. No auth.
 *
 * Caching: NONE (no-store). This feed must reflect admin deletes/disables
 * immediately — a deleted ad must never be served again. The payload is tiny;
 * freshness beats the few ms a cache would save.
 */
export interface SiteAd {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  animation: "fade" | "slide-up" | "slide-in-right" | "zoom" | "bounce";
  durationSec: number;
  pages: string[]; // empty = all pages
  enabled: boolean;
  createdAt: string;
}

const KEY = "site_ads";

export async function GET() {
  const { value: all, updatedAt } = await getKVWithMeta<SiteAd[]>(KEY, []);
  const ads = all
    .filter((a) => a && a.enabled)
    .map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
      linkUrl: a.linkUrl,
      animation: a.animation,
      durationSec: a.durationSec,
      pages: a.pages ?? [],
    }));
  return NextResponse.json(
    { ads },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        // Lets clients/admins confirm they are seeing the latest write.
        "X-Ads-Version": updatedAt ?? "none",
      },
    }
  );
}
