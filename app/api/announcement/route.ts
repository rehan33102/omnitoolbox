import { NextResponse } from "next/server";
import { getAnnouncements, publicAnnouncements } from "@/lib/announcement";

export const dynamic = "force-dynamic";

// Disable Next.js Data Cache for this route: supabase-js uses fetch()
// internally, and Next would otherwise cache those DB queries, serving
// stale KV rows to the public feed.
export const fetchCache = "force-no-store";

/** Public: enabled site announcements, newest first, for AnnouncementBar. */
export async function GET() {
  const list = await getAnnouncements();
  const announcements = publicAnnouncements(list);
  return NextResponse.json(
    { announcements },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
