import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { logActivity } from "@/lib/activity";

const ROUTES = [
  "/",
  "/ai-voiceover",
  "/ai-prompt-studio",
  "/calculators",
  "/media-tools",
  "/pdf-tools",
  "/social-tools",
  "/web-tools",
  "/tutorial",
  "/download",
  "/blog",
  "/contact",
];

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fixHref: string;
}

function baseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "https://omnitoolbox-zeta.vercel.app";
  }
}

async function fetchPage(url: string): Promise<{ status: number; html: string; error?: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "OmniToolBox-SEO-Audit/1.0" },
      redirect: "follow",
    });
    const html = res.ok ? await res.text() : "";
    return { status: res.status, html };
  } catch (e) {
    return { status: 0, html: "", error: e instanceof Error ? e.message : String(e) };
  }
}

const metaContent = (tag: string | null): string | null => {
  if (!tag) return null;
  const m = tag.match(/content=(["'])(.*?)\1/i);
  return m ? m[2] : null;
};

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:seo-audit", max: 10 });
  if (sec) return sec;
  if (!(await requirePermission("seo"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const base = baseUrl();
  const checks: Check[] = [];

  // 1. Fetch the 12 main routes in parallel.
  const pages = await Promise.all(
    ROUTES.map(async (path) => ({ path, ...(await fetchPage(base + path)) }))
  );

  const titles: { path: string; title: string }[] = [];
  for (const p of pages) {
    const url = base + p.path;
    if (p.status !== 200) {
      checks.push({
        name: `Page ${p.path}`,
        ok: false,
        detail: p.status === 0 ? `fetch failed: ${p.error ?? "timeout"}` : `HTTP ${p.status} — page not serving 200`,
        fixHref: url,
      });
      continue;
    }
    const title = p.html.match(/<title[^>]*>([^<]{1,400})<\/title>/i)?.[1]?.trim() ?? "";
    const descTag = p.html.match(/<meta[^>]*name=["']description["'][^>]*>/i)?.[0] ?? null;
    const desc = metaContent(descTag)?.trim() ?? "";
    const ogTag = p.html.match(/<meta[^>]*property=["']og:image["'][^>]*>/i)?.[0] ?? null;
    const og = metaContent(ogTag)?.trim() ?? "";

    if (title) titles.push({ path: p.path, title });

    const missing: string[] = [];
    if (!title) missing.push("no <title>");
    if (!desc) missing.push("no meta description");
    if (!og) missing.push("no og:image");

    checks.push({
      name: `Page ${p.path}`,
      ok: missing.length === 0,
      detail:
        missing.length > 0
          ? missing.join(" · ")
          : `title (${title.length} chars) · description (${desc.length} chars) · og:image present`,
      fixHref: url,
    });
  }

  // 2. Title uniqueness across the fetched pages.
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const t of titles) {
    const key = t.title.toLowerCase();
    if (seen.has(key)) dupes.push(`"${t.title}" on ${seen.get(key)} and ${t.path}`);
    else seen.set(key, t.path);
  }
  checks.push({
    name: "Unique <title> across pages",
    ok: dupes.length === 0 && titles.length > 0,
    detail:
      titles.length === 0
        ? "no titles found to compare"
        : dupes.length > 0
          ? `duplicate titles: ${dupes.slice(0, 3).join(" · ")}`
          : `${titles.length}/${pages.length} pages have unique titles`,
    fixHref: "/admin/seo",
  });

  // 3. Sample 8 internal links from the homepage and verify they return 200.
  const home = pages.find((p) => p.path === "/");
  if (home && home.status === 200) {
    const hrefs = new Set<string>();
    const re = /<a[^>]+href=(["'])(\/[^"']*)\1/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(home.html)) && hrefs.size < 40) {
      const href = m[2].split("#")[0].split("?")[0];
      if (!href || /\.\w{2,4}$/.test(href)) continue; // skip asset files
      hrefs.add(href);
    }
    const sample = [...hrefs].slice(0, 8);
    const results = await Promise.all(sample.map(async (h) => ({ h, ...(await fetchPage(base + h)) })));
    const bad = results.filter((r) => r.status !== 200);
    checks.push({
      name: "Internal links (8 sampled from homepage)",
      ok: sample.length > 0 && bad.length === 0,
      detail:
        sample.length === 0
          ? "no internal links found on homepage"
          : bad.length > 0
            ? `broken: ${bad.map((b) => `${b.h} (HTTP ${b.status || "fetch failed"})`).join(", ")}`
            : `${results.length}/${results.length} sampled links return 200`,
      fixHref: base + "/",
    });
  } else {
    checks.push({
      name: "Internal links (8 sampled from homepage)",
      ok: false,
      detail: "homepage did not return 200 — could not sample links",
      fixHref: base + "/",
    });
  }

  // 4. sitemap.xml + robots.txt are live.
  const [sm, rb] = await Promise.all([fetchPage(base + "/sitemap.xml"), fetchPage(base + "/robots.txt")]);
  const urlCount = sm.status === 200 ? (sm.html.match(/<url>/g) ?? []).length : 0;
  checks.push({
    name: "sitemap.xml is live",
    ok: sm.status === 200 && urlCount > 0,
    detail:
      sm.status !== 200
        ? `HTTP ${sm.status || "fetch failed"}`
        : urlCount > 0
          ? `${urlCount} URLs listed`
          : "served but contains no URLs",
    fixHref: base + "/sitemap.xml",
  });
  checks.push({
    name: "robots.txt is live",
    ok: rb.status === 200 && rb.html.length > 0,
    detail: rb.status !== 200 ? `HTTP ${rb.status || "fetch failed"}` : `${rb.html.length} bytes served`,
    fixHref: base + "/robots.txt",
  });

  const passed = checks.filter((c) => c.ok).length;
  await logActivity("seo.audit_run", `SEO audit: ${passed}/${checks.length} checks passed`);

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    base,
    summary: { passed, total: checks.length },
    checks,
  });
}
