import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { TOOLS } from "@/lib/tools-registry";

const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:stats", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("dashboard"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 14 * DAY).toISOString();
  const mid = new Date(Date.now() - 7 * DAY).toISOString();

  // Defensive geo select: country/city columns only exist after migration
  // 013 / the setup SQL. Try with them, fall back to the bare select so the
  // whole stats endpoint never breaks on older databases.
  interface EventRow {
    tool_slug: string;
    action: string;
    viewer: string | null;
    created_at: string;
    country?: string | null;
    city?: string | null;
  }
  let rows: EventRow[] = [];
  let geoEnabled = false;
  {
    const withGeo = await supabase
      .from("analytics_events")
      .select("tool_slug, action, viewer, created_at, country, city")
      .gte("created_at", since);
    if (withGeo.error) {
      const bare = await supabase
        .from("analytics_events")
        .select("tool_slug, action, viewer, created_at")
        .gte("created_at", since);
      rows = (bare.data ?? []) as EventRow[];
    } else {
      rows = (withGeo.data ?? []) as EventRow[];
      geoEnabled = true;
    }
  }
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

  // Total registered users + recent signups (auth.users via admin client).
  // listUsers returns users newest-first, so page 1 holds the latest signups.
  let totalUsers = 0;
  let signups24h = 0;
  let recentUsers: { email: string; created_at: string }[] = [];
  try {
    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    totalUsers = (userList && "total" in userList ? userList.total : 0) ?? 0;
    const dayCutoff = new Date(Date.now() - DAY).toISOString();
    const pages = Math.min(Math.ceil(totalUsers / 100), 10);
    for (let p = 1; p <= pages; p++) {
      const { data } = await supabase.auth.admin.listUsers({ page: p, perPage: 100 });
      const users = data?.users ?? [];
      signups24h += users.filter((u) => u.created_at >= dayCutoff).length;
      if (p === 1) {
        recentUsers = users
          .slice(0, 50)
          .map((u) => ({ email: u.email ?? "", created_at: u.created_at }));
      }
      // Early exit: users are sorted newest-first, stop when we pass the cutoff
      if (users.length > 0 && users[users.length - 1].created_at < dayCutoff) break;
    }
  } catch {
    /* auth admin unavailable — leave defaults */
  }

  const ctr = (rs: typeof rows) => {
    const pv = pageViews(rs);
    return pv === 0 ? 0 : (toolUses(rs) / pv) * 100;
  };

  // daily series
  const daily: { date: string; views: number; uses: number; visitors: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    const dayRows = rows.filter((r) => r.created_at.slice(0, 10) === key);
    daily.push({
      date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
      views: pageViews(dayRows),
      uses: toolUses(dayRows),
      visitors: visitors(dayRows),
    });
  }

  // Slug normalization: page_views arrive as pathnames ("/tools/ai-prompt-studio")
  // while "use" events arrive as bare slugs ("ai-prompt-studio").
  const normalizeSlug = (s: string) => s.replace(/^\/+/, "").replace(/^tools\//, "") || "/";
  const toolEntry = (slug: string) => TOOLS.find((t) => t.slug === normalizeSlug(slug));
  const titleOf = (slug: string) => toolEntry(slug)?.title ?? normalizeSlug(slug);
  const hrefOf = (slug: string) => toolEntry(slug)?.href ?? null;

  // top tools (by "use" actions)
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    if (r.action === "use") counts.set(r.tool_slug, (counts.get(r.tool_slug) ?? 0) + 1);
  });
  const topTools = [...counts.entries()]
    .map(([slug, uses]) => ({ slug, title: titleOf(slug), uses }))
    .sort((a, b) => b.uses - a.uses);

  // full per-tool breakdown (views + uses), keyed on normalized slug
  const perToolMap = new Map<string, { rawSlug: string; views: number; uses: number }>();
  rows.forEach((r) => {
    const key = normalizeSlug(r.tool_slug);
    const e = perToolMap.get(key) ?? { rawSlug: r.tool_slug, views: 0, uses: 0 };
    if (r.action === "page_view") e.views += 1;
    if (r.action === "use") e.uses += 1;
    perToolMap.set(key, e);
  });
  const perTool = [...perToolMap.entries()]
    .map(([slug, e]) => ({
      slug: e.rawSlug,
      title: titleOf(e.rawSlug),
      href: hrefOf(e.rawSlug),
      views: e.views,
      uses: e.uses,
    }))
    .sort((a, b) => b.uses - a.uses || b.views - a.views);

  // Top countries (country + city, distinct visitors) — only when the geo
  // columns exist; otherwise the visitors page shows the setup hint.
  const topCountries: { country: string; city: string | null; visitors: number }[] = [];
  if (geoEnabled) {
    const geoMap = new Map<string, { country: string; city: string | null; viewers: Set<string> }>();
    rows.forEach((r) => {
      if (!r.country) return;
      const key = `${r.country}|||${r.city ?? ""}`;
      let e = geoMap.get(key);
      if (!e) {
        e = { country: r.country, city: r.city ?? null, viewers: new Set<string>() };
        geoMap.set(key, e);
      }
      if (r.viewer) e.viewers.add(r.viewer);
    });
    topCountries.push(
      ...[...geoMap.values()]
        .map((e) => ({ country: e.country, city: e.city, visitors: e.viewers.size }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 20)
    );
  }

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
    perTool,
    topCountries,
    geoEnabled,
    liveVisitors,
    totalUsers,
    signups24h,
    recentUsers,
  });
}
