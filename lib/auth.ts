import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SessionUser {
  id: string;
  email: string;
  role: "admin" | "user";
}

/** Emails that are always admin (comma-separated env). No Supabase SQL needed. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function getSessionUser(): Promise<SessionUser | null> {
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
