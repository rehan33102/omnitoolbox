import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKV } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requirePermission("settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const key = req.nextUrl.searchParams.get("key") ?? "site_branding";
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seo_settings")
    .select("key, value, updated_at")
    .eq("key", key)
    .order("updated_at", { ascending: false });
  const viaGetKV = await getKV(key, { _fallback: true });
  return NextResponse.json({
    key,
    error: error?.message ?? null,
    rowCount: Array.isArray(data) ? data.length : 0,
    directRows: (data ?? []).map((r: { key: string; value: string; updated_at: string }) => ({
      updated_at: r.updated_at,
      valuePreview: (r.value ?? "").slice(0, 120),
    })),
    viaGetKVPreview: JSON.stringify(viaGetKV).slice(0, 120),
  });
}
