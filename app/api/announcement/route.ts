import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { DEFAULT_ANNOUNCEMENT, type SiteAnnouncement } from "@/lib/announcement";

export const dynamic = "force-dynamic";

/** Public: current site announcement for AnnouncementBar. */
export async function GET() {
  const announcement = await getKV<SiteAnnouncement>("site_announcement", DEFAULT_ANNOUNCEMENT);
  return NextResponse.json(
    { announcement },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-KV-Code": "v2-robust",
      },
    }
  );
}
