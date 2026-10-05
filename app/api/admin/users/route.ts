import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

/**
 * GET /api/admin/users — list registered users (admin only).
 * Query: ?page=1&search=foo
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const search = req.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

  const { data, error } = await supabase.auth.admin.listUsers({
    page,
    perPage: PAGE_SIZE,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let users = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    fullName: (u.user_metadata?.full_name as string | undefined) ?? "",
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    emailConfirmed: !!u.email_confirmed_at,
    banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    isSelf: u.id === admin.id,
  }));

  if (search) {
    users = users.filter(
      (u) => u.email.toLowerCase().includes(search) || u.fullName.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({
    users,
    page,
    perPage: PAGE_SIZE,
    total: (data && "total" in data ? data.total : 0) ?? users.length,
  });
}

/**
 * DELETE /api/admin/users?id=… — permanently delete a user (admin only).
 * Refuses to delete the caller's own account.
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
