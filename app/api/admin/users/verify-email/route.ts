import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
});

/**
 * POST /api/admin/users/verify-email — manually confirm a user's email
 * without sending a verification link (users-section permission).
 * Body: { id: string }
 */
export async function POST(req: NextRequest) {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(body.data.id, {
      email_confirm: true,
    });
    if (error) throw error;
    const { data: target } = await supabase.auth.admin.getUserById(body.data.id);
    await logActivity(
      "user.email_verified",
      `Email manually verified for ${target?.user?.email ?? body.data.id.slice(0, 8)}`,
      admin.email
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
