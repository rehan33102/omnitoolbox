import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";
import { guardApi } from "@/lib/api-security";
import { TOOLS } from "@/lib/tools-registry";

const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:stats", max: 30 });
  if (sec) return sec;
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 14 * DAY).toISOString();
  const mid = new Date(Date.now() - 7 * DAY).toISOString();

  const { data: events } = await supabase
    .from("analytics_events")
    .select("tool_slug, action, viewer, created_at")
    .gte("created_at", since);

  const rows = events ?? [];
  const inWindow = (from: string) => rows.filter((r) => r.created_at >= from);
  const visitors = (rs: typeof rows) => new Set(rs.map((r) => r.viewer).filter(Boolean)).size;
  const pageViews = (rs: typeof rows) => rs.filter((r) => r.action === "page_view").length;
  const toolUses = (rs: typeof rows) => rs.filter((r) => r.action === "use").length;

  const cur = inWindow(mid);
  const prev = rows.filter((r) => r.created_at < mid);
  const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));

  // Live visitors: distinct viewers active in the last 5 minutes.
  const liveCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const liveVisitors = new Set(
    rows.filter((r) => r.created_at >= liveCutoff).map((r) => r.viewer).filter(Boolean)
  ).size;

  // Total registered users (auth.users via admin client).
  let totalUsers = 0;
  try {
    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    totalUsers = (userList && "total" in userList ? userList.total : 0) ?? 0;
  } catch {
    /* table/API unavailable — leave 0 */
  }

  const ctr = (rs: typeof rows) => {
    const pv = pageViews(rs);
    return pv === 0 ? 0 : (toolUses(rs) / pv) * 100;
  };

  // daily series
  const daily: { date: string; views: number; uses: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    const dayRows = rows.filter((r) => r.created_at.slice(0, 10) === key);
    daily.push({
      date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
      views: pageViews(dayRows),
      uses: toolUses(dayRows),
    });
  }

  // top tools
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    if (r.action === "use") counts.set(r.tool_slug, (counts.get(r.tool_slug) ?? 0) + 1);
  });
  const titleOf = (slug: string) => TOOLS.find((t) => t.slug === slug)?.title ?? slug;
  const topTools = [...counts.entries()]
    .map(([slug, uses]) => ({ slug, title: titleOf(slug), uses }))
    .sort((a, b) => b.uses - a.uses);

  return NextResponse.json({
    totals: {
      visitors: visitors(cur),
      pageViews: pageViews(cur),
      toolUses: toolUses(cur),
      ctr: ctr(cur),
      deltas: {
        visitors: pct(visitors(cur), visitors(prev)),
        pageViews: pct(pageViews(cur), pageViews(prev)),
        toolUses: pct(toolUses(cur), toolUses(prev)),
        ctr: Math.round((ctr(cur) - ctr(prev)) * 10) / 10,
      },
    },
    daily,
    topTools,
    liveVisitors,
    totalUsers,
  });
}
