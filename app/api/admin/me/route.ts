import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPermissionsFor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/me — who is calling, with their role and section permissions.
 * Used by admin UI for client-side gating (badges, conditional controls).
 * NOTE: /api/admin/* is also gated by middleware (admin-only via profiles
 * table), so this effectively serves admins today; moderators will be able to
 * use it once middleware learns the KV roles.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = await getPermissionsFor(user.role);
  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    permissions,
  });
}
