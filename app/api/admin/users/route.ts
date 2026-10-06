import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";
import { invalidateRoleCache } from "@/lib/auth";
import {
  requirePermission,
  setUserRole,
  clearUserRole,
  isRole,
  USER_ROLES_KEY,
  type Role,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

interface Diagnostics {
  listUsersOk: boolean;
  error?: string;
  serviceKeyPresent: boolean;
  fetchedAt: string;
}

/**
 * GET /api/admin/users — list registered users (users-section permission).
 * Query: ?page=1&search=foo
 *
 * Always returns diagnostics so the UI can show a visible, non-blocking
 * status line when auth.admin.listUsers fails (empty DB, service-key issue,
 * etc.) instead of failing silently. Never fakes user data.
 */
export async function GET(req: NextRequest) {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const search = req.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

  const diagnostics: Diagnostics = {
    listUsersOk: true,
    serviceKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    fetchedAt: new Date().toISOString(),
  };

  let listResult;
  try {
    listResult = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
  } catch (err) {
    listResult = { data: { users: [] }, error: err as Error };
  }
  const { data, error } = listResult as { data: { users: any[] } | null; error: { message: string } | null };

  if (error || !data) {
    diagnostics.listUsersOk = false;
    diagnostics.error = error?.message ?? "Unknown listUsers failure";
    return NextResponse.json({ users: [], page, perPage: PAGE_SIZE, total: 0, diagnostics });
  }

  // Attach effective roles: base from profiles table + KV admin-set overrides.
  const ids = data.users.map((u) => u.id);
  const roleOverrides = await getKV<Record<string, unknown>>(USER_ROLES_KEY, {});
  let profileRoles = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, role").in("id", ids);
    profileRoles = new Map((profiles ?? []).map((p: { id: string; role: string }) => [p.id, p.role]));
  }

  let users = data.users.map((u) => {
    const override = roleOverrides?.[u.id];
    const role: Role = isRole(override)
      ? override
      : profileRoles.get(u.id) === "admin"
        ? "admin"
        : "user";
    return {
      id: u.id,
      email: u.email ?? "",
      fullName: (u.user_metadata?.full_name as string | undefined) ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      emailConfirmed: !!u.email_confirmed_at,
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
      role,
      isSelf: u.id === admin.id,
    };
  });

  if (search) {
    users = users.filter(
      (u) => u.email.toLowerCase().includes(search) || u.fullName.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({
    users,
    page,
    perPage: PAGE_SIZE,
    total: (data && "total" in data ? (data as { total?: number }).total : 0) ?? users.length,
    diagnostics,
  });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["admin", "moderator", "user", "banned"]).optional(),
  email: z.string().email().max(254).optional(),
  fullName: z.string().max(120).optional(),
});

/**
 * PATCH /api/admin/users — edit a user (users-section permission).
 * Body: { id, role?, email?, fullName? }
 * - role: writes KV user_roles + syncs profiles.role when admin/user
 *   (the profiles check constraint only allows those two values).
 * - email/fullName: updates the auth user via admin API.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { id, role, email, fullName } = body.data;
  if (!role && email === undefined && fullName === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const changes: string[] = [];

  try {
    if (role) {
      if (id === admin.id) {
        return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
      }
      const ok = await setUserRole(id, role);
      if (!ok) return NextResponse.json({ error: "Failed to save role" }, { status: 500 });
      // Sync the profiles column when the constraint allows it, so middleware
      // (which only reads profiles) keeps working for admins.
      if (role === "admin" || role === "user") {
        const { data: target } = await supabase.auth.admin.getUserById(id);
        await supabase
          .from("profiles")
          .upsert({ id, email: target?.user?.email ?? "", role }, { onConflict: "id" });
      }
      invalidateRoleCache(id);
      changes.push(`role → ${role}`);
    }

    if (email !== undefined || fullName !== undefined) {
      const { data: current } = await supabase.auth.admin.getUserById(id);
      if (!current?.user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const updates: { email?: string; user_metadata?: Record<string, string> } = {};
      if (email !== undefined && email.trim().toLowerCase() !== (current.user.email ?? "").toLowerCase()) {
        updates.email = email.trim();
        changes.push(`email → ${email.trim()}`);
      }
      if (fullName !== undefined) {
        updates.user_metadata = { ...(current.user.user_metadata ?? {}), full_name: fullName.trim() };
        changes.push(`name → ${fullName.trim() || "(cleared)"}`);
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.admin.updateUserById(id, updates);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        if (updates.email) {
          await supabase.from("profiles").update({ email: updates.email }).eq("id", id);
        }
      }
    }

    if (changes.length > 0) {
      await logActivity("user.updated", `User ${id.slice(0, 8)}… updated: ${changes.join(", ")}`, admin.email);
    }
    return NextResponse.json({ ok: true, changes });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users?id=… — permanently delete a user (users-section permission).
 * Refuses to delete the caller's own account. Verifies the deletion with a
 * re-fetch and cleans up the KV role entry.
 */
export async function DELETE(req: NextRequest) {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase.auth.admin.getUserById(id);
  const targetEmail = target?.user?.email ?? id.slice(0, 8);

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Rigorous: confirm the user is actually gone via re-list.
  const { data: check } = await supabase.auth.admin.getUserById(id);
  const verified = !check?.user;

  await clearUserRole(id);
  await supabase.from("profiles").delete().eq("id", id);
  await logActivity("user.deleted", `User deleted: ${targetEmail} (verified: ${verified ? "yes" : "no"})`, admin.email);

  return NextResponse.json({ ok: true, verified });
}
