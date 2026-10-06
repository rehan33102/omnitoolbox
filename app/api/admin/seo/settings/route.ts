import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { siteUrl } from "@/lib/utils";
import { getKV, getKVRaw, setKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);

async function getLastGenerated(): Promise<string | null> {
  const raw = await getKVRaw("sitemap_last_generated");
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v === "string" ? v : raw;
  } catch {
    return raw;
  }
}

async function readAll() {
  const [sitemapToggles, defaults, robots, verification, overrides, lastGenerated, meta] = await Promise.all([
    getKV("seo_sitemap", { tools: true, blog: true, directory: true }),
    getKV("seo_defaults", { titleTemplate: "", description: "", ogImage: "", twitterCard: "summary_large_image" }),
    getKV("seo_robots", { rules: "" }),
    getKV("seo_verification", { google: "", bing: "" }),
    getKV("seo_overrides", []),
    getLastGenerated(),
    getKV<{ urlCount?: number } | null>("seo_sitemap_meta", null),
  ]);
  return {
    sitemap: {
      tools: bool((sitemapToggles as Record<string, unknown>).tools, true),
      blog: bool((sitemapToggles as Record<string, unknown>).blog, true),
      directory: bool((sitemapToggles as Record<string, unknown>).directory, true),
    },
    defaults: {
      titleTemplate: str((defaults as Record<string, unknown>).titleTemplate),
      description: str((defaults as Record<string, unknown>).description),
      ogImage: str((defaults as Record<string, unknown>).ogImage),
      twitterCard: (defaults as Record<string, unknown>).twitterCard === "summary" ? "summary" : "summary_large_image",
    },
    robots: { rules: str((robots as Record<string, unknown>).rules) },
    verification: {
      google: str((verification as Record<string, unknown>).google),
      bing: str((verification as Record<string, unknown>).bing),
    },
    overrides: Array.isArray(overrides) ? overrides : [],
    lastGenerated,
    urlCount: meta?.urlCount ?? null,
    sitemapUrl: siteUrl("/sitemap.xml"),
    robotsUrl: siteUrl("/robots.txt"),
  };
}

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:seo-settings", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("seo"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await readAll());
}

export async function PUT(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:seo-settings", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("seo"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const saved: string[] = [];

  if (body.sitemap && typeof body.sitemap === "object") {
    const s = body.sitemap as Record<string, unknown>;
    await setKV("seo_sitemap", {
      tools: bool(s.tools, true),
      blog: bool(s.blog, true),
      directory: bool(s.directory, true),
    });
    saved.push("sitemap sections");
  }

  if (body.defaults && typeof body.defaults === "object") {
    const d = body.defaults as Record<string, unknown>;
    const twitterCard = d.twitterCard === "summary" ? "summary" : "summary_large_image";
    await setKV("seo_defaults", {
      titleTemplate: str(d.titleTemplate).slice(0, 200),
      description: str(d.description).slice(0, 500),
      ogImage: str(d.ogImage).slice(0, 500),
      twitterCard,
    });
    saved.push("global defaults");
  }

  if (body.robots && typeof body.robots === "object") {
    const r = body.robots as Record<string, unknown>;
    await setKV("seo_robots", { rules: str(r.rules).slice(0, 10000) });
    saved.push("robots.txt");
  }

  if (body.verification && typeof body.verification === "object") {
    const v = body.verification as Record<string, unknown>;
    await setKV("seo_verification", {
      google: str(v.google).slice(0, 500),
      bing: str(v.bing).slice(0, 500),
    });
    saved.push("verification codes");
  }

  if (Array.isArray(body.overrides)) {
    const clean = body.overrides
      .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
      .map((o) => ({
        path: str(o.path).trim().slice(0, 200) || "/",
        title: str(o.title).slice(0, 200),
        description: str(o.description).slice(0, 500),
        ogImage: str(o.ogImage).slice(0, 500),
      }))
      .filter((o) => o.title || o.description || o.ogImage)
      .slice(0, 100);
    await setKV("seo_overrides", clean);
    saved.push("page overrides");
  }

  if (saved.length === 0) {
    return NextResponse.json({ error: "Nothing to save — send sitemap, defaults, robots, verification or overrides" }, { status: 400 });
  }

  await logActivity("seo.settings_updated", `SEO settings updated: ${saved.join(", ")}`);
  return NextResponse.json({ ok: true, saved });
}
