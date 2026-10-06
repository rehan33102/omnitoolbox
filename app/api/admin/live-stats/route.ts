import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events stream for the admin dashboard.
 * Streams live stats every 5 seconds: live visitors, tool uses (last hour),
 * signups (last 24h), and total users. Auth via session cookie — the
 * EventSource request carries cookies automatically.
 */
export async function GET(request: Request) {
  if (!(await requirePermission("dashboard"))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const supabase = createAdminClient();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send an initial heartbeat comment so proxies don't buffer.
      controller.enqueue(encoder.encode(": connected\n\n"));

      const tick = async () => {
        try {
          const now = Date.now();
          const liveCutoff = new Date(now - 5 * 60 * 1000).toISOString();
          const hourCutoff = new Date(now - 60 * 60 * 1000).toISOString();
          const dayCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();

          // Live visitors: distinct viewers in last 5 min, plus a per-visitor
          // detail list (country/city + opt-in precise coords). The geo columns
          // only exist after migration 013 / the setup SQL — select defensively:
          // try with geo columns, fall back to the bare select so the stream
          // never breaks.
          interface LiveEventRow {
            viewer: string | null;
            created_at: string;
            country?: string | null;
            city?: string | null;
            latitude?: number | null;
            longitude?: number | null;
            user_id?: string | null;
            user_email?: string | null;
            user_name?: string | null;
          }
          let liveRows: LiveEventRow[] = [];
          let geoOk = false;
          const withGeo = await supabase
            .from("analytics_events")
            .select("viewer, created_at, country, city, latitude, longitude, user_id, user_email, user_name")
            .gte("created_at", liveCutoff);
          if (withGeo.error) {
            const bare = await supabase
              .from("analytics_events")
              .select("viewer, created_at")
              .gte("created_at", liveCutoff);
            liveRows = (bare.data ?? []) as LiveEventRow[];
          } else {
            liveRows = (withGeo.data ?? []) as LiveEventRow[];
            geoOk = true;
          }

          // Aggregate to one entry per viewer: latest activity wins for the
          // location fields, so the freshest reading is shown.
          const byViewer = new Map<
            string,
            {
              lastActive: string;
              country: string | null;
              city: string | null;
              latitude: number | null;
              longitude: number | null;
              userId: string | null;
              userEmail: string | null;
              userName: string | null;
            }
          >();
          for (const r of liveRows) {
            if (!r.viewer) continue;
            const e = byViewer.get(r.viewer) ?? {
              lastActive: "", country: null, city: null, latitude: null, longitude: null,
              userId: null, userEmail: null, userName: null,
            };
            if (r.created_at > e.lastActive) e.lastActive = r.created_at;
            if (r.country) e.country = r.country;
            if (r.city) e.city = r.city;
            if (typeof r.latitude === "number") e.latitude = r.latitude;
            if (typeof r.longitude === "number") e.longitude = r.longitude;
            if (r.user_id) e.userId = r.user_id;
            if (r.user_email) e.userEmail = r.user_email;
            if (r.user_name) e.userName = r.user_name;
            byViewer.set(r.viewer, e);
          }
          const liveVisitors = byViewer.size;
          const liveList = [...byViewer.entries()]
            .sort((a, b) => (a[1].lastActive < b[1].lastActive ? 1 : -1))
            .slice(0, 50)
            .map(([viewer, e]) => ({
              viewer: viewer.slice(0, 8),
              country: e.country,
              city: e.city,
              latitude: e.latitude,
              longitude: e.longitude,
              userId: e.userId,
              userEmail: e.userEmail,
              userName: e.userName,
              lastActive: e.lastActive,
            }));

          // Tool uses in the last hour
          const { count: hourlyUses } = await supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("action", "use")
            .gte("created_at", hourCutoff);

          // Page views in the last hour
          const { count: hourlyViews } = await supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("action", "page_view")
            .gte("created_at", hourCutoff);

          // Signups in last 24h (auth.users created_at)
          let signups24h = 0;
          let totalUsers = 0;
          try {
            const { data: userList } = await supabase.auth.admin.listUsers({
              page: 1,
              perPage: 1,
            });
            totalUsers = (userList && "total" in userList ? userList.total : 0) ?? 0;
            // Count recent signups via a paginated scan (cap at 1000 users)
            const pages = Math.min(Math.ceil(totalUsers / 100), 10);
            for (let p = 1; p <= pages; p++) {
              const { data } = await supabase.auth.admin.listUsers({ page: p, perPage: 100 });
              const users = data?.users ?? [];
              signups24h += users.filter((u) => u.created_at >= dayCutoff).length;              // Early exit: users are sorted newest-first, stop when we pass the cutoff
              if (users.length > 0 && users[users.length - 1].created_at < dayCutoff) break;
            }
          } catch {
            /* auth admin unavailable */
          }

          send({
            type: "live-stats",
            ts: new Date().toISOString(),
            liveVisitors,
            liveList,
            geoEnabled: geoOk,
            hourlyUses: hourlyUses ?? 0,
            hourlyViews: hourlyViews ?? 0,
            signups24h,
            totalUsers,
          });
        } catch (err) {
          send({ type: "error", message: (err as Error).message });
        }
      };

      await tick();
      const interval = setInterval(tick, 5_000);

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
