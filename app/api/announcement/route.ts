import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { DEFAULT_ANNOUNCEMENT, type SiteAnnouncement } from "@/lib/announcement";

export const dynamic = "force-dynamic";

// Disable Next.js Data Cache for this route: supabase-js uses fetch()
// internally, and Next would otherwise cache those DB queries, serving
// stale KV rows to the public feed.
export const fetchCache = "force-no-store";

/** Public: current site announcement for AnnouncementBar. */
export async function GET() {
  const announcement = await getKV<SiteAnnouncement>("site_announcement", DEFAULT_ANNOUNCEMENT);
  return NextResponse.json(
    { announcement },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
