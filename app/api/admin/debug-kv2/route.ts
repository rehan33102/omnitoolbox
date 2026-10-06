import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requirePermission("settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const key = req.nextUrl.searchParams.get("key") ?? "site_branding";
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seo_settings")
    .select("key, updated_at")
    .eq("key", key)
    .order("updated_at", { ascending: false });
  return NextResponse.json({
    key,
    error: error?.message ?? null,
    rowCount: Array.isArray(data) ? data.length : 0,
    rows: data ?? [],
  });
}
