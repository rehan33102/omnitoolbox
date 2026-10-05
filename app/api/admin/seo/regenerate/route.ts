import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";
import { guardApi } from "@/lib/api-security";
import { siteUrl } from "@/lib/utils";

async function ping(engine: string, endpoint: string, sitemapUrl: string) {
  try {
    const res = await fetch(`${endpoint}?sitemap=${sitemapUrl}`, { signal: AbortSignal.timeout(8000) });
    return { engine, ok: res.ok };
  } catch {
    return { engine, ok: false };
  }
}

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:seo", max: 30 });
  if (sec) return sec;
  if (!(await requireAdminApi())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = createAdminClient();
  const { data } = await supabase.from("seo_settings").select("value").eq("key", "sitemap_last_generated").single();
  return NextResponse.json({ lastGenerated: data?.value ?? null, pings: null });
}

export async function POST(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:seo", max: 30 });
  if (sec) return sec;
  if (!(await requireAdminApi())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sitemapUrl = encodeURIComponent(siteUrl("/sitemap.xml"));
  const pings = await Promise.all([
    ping("Google", "https://www.google.com/ping", sitemapUrl),
    ping("Bing", "https://www.bing.com/ping", sitemapUrl),
  ]);

  const now = new Date().toISOString();
  try {
    const supabase = createAdminClient();
    await supabase.from("seo_settings").upsert({ key: "sitemap_last_generated", value: now });
  } catch { /* non-fatal */ }

  return NextResponse.json({ lastGenerated: now, pings, sitemap: siteUrl("/sitemap.xml") });
}
