import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

/** Temporary diagnostic: dump ALL rows for a KV key. Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await requirePermission("settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seo_settings")
    .select("key, value, updated_at")
    .eq("key", key)
    .order("updated_at", { ascending: false });
  const rows = Array.isArray(data) ? data : [];
  return NextResponse.json({
    key,
    error: error?.message ?? null,
    rowCount: rows.length,
    rows: rows.map((r: { key: string; value: string; updated_at: string }) => ({
      key: JSON.stringify(r.key),
      updated_at: r.updated_at,
      valuePreview: (r.value ?? "").slice(0, 150),
      valueLength: (r.value ?? "").length,
    })),
  });
}
