import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/reset-password — send a password reset email (users-section permission).
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logActivity("user.password_reset", `Password reset email sent to ${email}`, admin.email);
  return NextResponse.json({ ok: true });
}
