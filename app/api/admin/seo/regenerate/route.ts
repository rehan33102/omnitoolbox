import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { siteUrl } from "@/lib/utils";
import { getKV, getKVRaw, setKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";
import sitemap from "@/app/sitemap";

/** Read the legacy-or-JSON timestamp: the old code stored a raw ISO string. */
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

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:seo", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("seo"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [lastGenerated, meta] = await Promise.all([
    getLastGenerated(),
    getKV<{ urlCount?: number } | null>("seo_sitemap_meta", null),
  ]);
  return NextResponse.json({
    lastGenerated,
    urlCount: meta?.urlCount ?? null,
    sitemap: siteUrl("/sitemap.xml"),
  });
}

export async function POST(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:seo", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("seo"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Rebuild the sitemap now and count its URLs — honest, computed live.
  let urlCount: number | null = null;
  try {
    const entries = await sitemap();
    urlCount = entries.length;
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/sitemap.xml");
    } catch {
      /* cache purge is best-effort; the hourly revalidate still applies */
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Sitemap rebuild failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  await setKV("sitemap_last_generated", now);
  await setKV("seo_sitemap_meta", { urlCount });
  await logActivity("seo.sitemap_regenerated", `Sitemap regenerated — ${urlCount} URLs`);

  return NextResponse.json({ ok: true, lastGenerated: now, urlCount, sitemap: siteUrl("/sitemap.xml") });
}
