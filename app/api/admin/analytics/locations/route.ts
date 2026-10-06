import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Location History — permanent log of every precise (user-consented)
 * geolocation reading saved on `geo_precise` analytics events.
 *
 * GET /api/admin/analytics/locations?limit=20&offset=0
 * Returns rows from analytics_events where latitude AND longitude are not
 * null, newest-first. This log is PERMANENT: there is no auto-delete/TTL
 * logic anywhere near it.
 */
export async function GET(request: Request) {
  if (!(await requirePermission("dashboard"))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const rawOffset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  const supabase = createAdminClient();

  interface LocationRow {
    id: string;
    created_at: string;
    latitude: number;
    longitude: number;
    country: string | null;
    city: string | null;
    user_id: string | null;
    user_email: string | null;
    user_name: string | null;
  }

  const { data, error, count } = await supabase
    .from("analytics_events")
    .select(
      "id, created_at, latitude, longitude, country, city, user_id, user_email, user_name",
      { count: "exact" }
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (data ?? []) as LocationRow[];

  return new Response(
    JSON.stringify({
      rows,
      total: count ?? rows.length,
      limit,
      offset,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
