import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/suspend — suspend or unsuspend a user (users-section permission).
 * Body: { id: string, suspend: boolean }
 * Uses ban_duration so the banned_until flag is what the users list reads.
 * Refuses to suspend the caller's own account.
 */
export async function POST(req: NextRequest) {
  const admin = await requirePermission("users");
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
  await logActivity(
    suspend ? "user.suspended" : "user.unsuspended",
    `User ${id.slice(0, 8)}… ${suspend ? "suspended" : "unsuspended"}`,
    admin.email
  );
  return NextResponse.json({ ok: true, suspended: !!suspend });
}
