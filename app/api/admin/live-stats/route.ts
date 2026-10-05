import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events stream for the admin dashboard.
 * Streams live stats every 5 seconds: live visitors, tool uses (last hour),
 * signups (last 24h), and total users. Auth via session cookie — the
 * EventSource request carries cookies automatically.
 */
export async function GET(request: Request) {
  if (!(await requireAdminApi())) {
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

          // Live visitors: distinct viewers in last 5 min
          const { data: liveEvents } = await supabase
            .from("analytics_events")
            .select("viewer")
            .gte("created_at", liveCutoff);
          const liveVisitors = new Set(
            (liveEvents ?? []).map((r) => r.viewer).filter(Boolean)
          ).size;

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
