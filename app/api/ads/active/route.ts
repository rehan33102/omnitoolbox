import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";

/**
 * GET /api/ads/active — public feed of enabled popup ads for the AdPopup
 * client component. No auth. Response is cacheable for 60s.
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
  const all = await getKV<SiteAd[]>(KEY, []);
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
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
