import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, setUserRole } from "@/lib/permissions";
import { invalidateRoleCache } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
  makeAdmin: z.boolean(),
});

/**
 * POST /api/admin/users/make-admin — grant or revoke admin role (users-section permission).
 * Body: { id: string, makeAdmin: boolean }
 * Writes both the profiles column and the KV role override so the two stay
 * in sync. Refuses to change the caller's own role.
 */
export async function POST(req: NextRequest) {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (body.data.id === admin.id) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    // Get user's email from auth (profiles.email is NOT NULL)
    const { data: userData } = await supabase.auth.admin.getUserById(body.data.id);
    const email = userData?.user?.email ?? "";
    const role = body.data.makeAdmin ? "admin" : "user";
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: body.data.id, email, role }, { onConflict: "id" });
    if (error) throw error;
    await setUserRole(body.data.id, role);
    invalidateRoleCache(body.data.id);
    await logActivity(
      body.data.makeAdmin ? "user.made_admin" : "user.admin_removed",
      `${email || body.data.id.slice(0, 8)} ${body.data.makeAdmin ? "granted admin" : "admin revoked"}`,
      admin.email
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
