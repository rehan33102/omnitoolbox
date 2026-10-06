import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKV } from "@/lib/kv";

export interface SessionUser {
  id: string;
  email: string;
  role: "admin" | "moderator" | "user" | "banned";
}

/** Owner emails — always admin, immune to role overrides. Must match middleware.ts. */
const OWNER_EMAILS = ["rehan.work3310@gmail.com", "info.rehan3310@gmail.com"];

/** KV key for admin-set extended roles (see lib/permissions.ts). Kept local to avoid an import cycle. */
const USER_ROLES_KEY = "user_roles";

/** Emails that are always admin (comma-separated env). No Supabase SQL needed. */
function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  // Owner email — always admin
  return [...new Set([...fromEnv, ...OWNER_EMAILS])];
}

/**
 * Short-lived per-process role cache: getSessionUser runs on nearly every
 * admin request and the KV read is a service-role round-trip. 10s TTL keeps
 * it fast; role changes invalidate the entry immediately (see
 * invalidateRoleCache, called by lib/permissions.ts and the users API).
 */
const roleCache = new Map<string, { role: SessionUser["role"]; ts: number }>();
const ROLE_CACHE_TTL_MS = 10_000;

export function invalidateRoleCache(userId: string): void {
  roleCache.delete(userId);
}

async function baseSessionUser(): Promise<SessionUser | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const email = (user.email ?? "").toLowerCase();

  // Service-role client bypasses RLS so we can bootstrap the profile row —
  // without this, first-time logins have no profile and can never be admin.
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      // SECURITY: No auto-bootstrap. Only emails in ADMIN_EMAILS env can ever be admin.
      // New users are always "user" role — admin must be granted explicitly.
      const role: "admin" | "user" = adminEmails().includes(email) ? "admin" : "user";
      const { data: created } = await admin
        .from("profiles")
        .insert({ id: user.id, email: user.email ?? "", role })
        .select("role")
        .single();
      return { id: user.id, email: user.email ?? "", role: (created?.role as SessionUser["role"]) ?? role };
    }

    // STRICT: Admin access requires email in ADMIN_EMAILS env — NEVER trust stored role alone.
    // If email is whitelisted, ensure admin. If NOT whitelisted but stored as admin, DEMOTE.
    const isWhitelisted = adminEmails().includes(email);
    if (isWhitelisted && profile.role !== "admin") {
      await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
      return { id: user.id, email: user.email ?? "", role: "admin" };
    }
    if (!isWhitelisted && profile.role === "admin") {
      // SECURITY: Non-whitelisted email had admin role — demote immediately.
      await admin.from("profiles").update({ role: "user" }).eq("id", user.id);
      return { id: user.id, email: user.email ?? "", role: "user" };
    }

    return { id: user.id, email: user.email ?? "", role: isWhitelisted ? "admin" : "user" };
  } catch {
    // Service role unavailable — fall back to the anon read path.
    // STRICT: Only whitelisted emails can be admin, even in fallback.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const isWhitelisted = adminEmails().includes(email);
    return {
      id: user.id,
      email: user.email ?? "",
      role: isWhitelisted ? "admin" : "user",
    };
  }
}

/**
 * Admin-set extended role override (KV `user_roles`, managed from the Users
 * page). Admin-set wins over the base role — except owner emails, which stay
 * admin no matter what. A "banned" override blocks the user everywhere.
 */
async function applyRoleOverride(
  id: string,
  email: string,
  base: SessionUser["role"]
): Promise<SessionUser["role"]> {
  if (OWNER_EMAILS.includes(email.toLowerCase())) return "admin";
  const cached = roleCache.get(id);
  if (cached && Date.now() - cached.ts < ROLE_CACHE_TTL_MS) return cached.role;
  try {
    const overrides = await getKV<Record<string, unknown>>(USER_ROLES_KEY, {});
    const raw = overrides?.[id];
    const role: SessionUser["role"] =
      raw === "admin" || raw === "moderator" || raw === "user" || raw === "banned"
        ? raw
        : base;
    roleCache.set(id, { role, ts: Date.now() });
    return role;
  } catch {
    return base;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const base = await baseSessionUser();
  if (!base) return null;
  const role = await applyRoleOverride(base.id, base.email, base.role);
  return role === base.role ? base : { ...base, role };
}

/** Page-level guard: redirects non-admins. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/?error=forbidden");
  return user;
}

/** API-level guard: returns null when the caller is not an admin. */
export async function requireAdminApi(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
