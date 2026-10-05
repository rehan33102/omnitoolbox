import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/suspend — suspend or unsuspend a user (admin only).
 * Body: { id: string, suspend: boolean }
 * Refuses to suspend the caller's own account.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { id?: string; suspend?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, suspend } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot suspend your own account" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(id, {
    // 100 years = effectively permanent ban; 'none' lifts it.
    ban_duration: suspend ? "876000h" : "none",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, suspended: !!suspend });
}
