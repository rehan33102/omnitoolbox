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
      // First-ever user in the system becomes admin automatically (bootstrap).
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      let role: "admin" | "user" = !count ? "admin" : "user";
      if (adminEmails().includes(email)) role = "admin";
      const { data: created } = await admin
        .from("profiles")
        .insert({ id: user.id, email: user.email ?? "", role })
        .select("role")
        .single();
      return { id: user.id, email: user.email ?? "", role: (created?.role as SessionUser["role"]) ?? role };
    }

    // Env-listed emails are promoted to admin even if the row says otherwise.
    if (adminEmails().includes(email) && profile.role !== "admin") {
      await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
      return { id: user.id, email: user.email ?? "", role: "admin" };
    }

    return { id: user.id, email: user.email ?? "", role: (profile.role as SessionUser["role"]) ?? "user" };
  } catch {
    // Service role unavailable — fall back to the anon read path.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return {
      id: user.id,
      email: user.email ?? "",
      role: (profile?.role as SessionUser["role"]) ?? "user",
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
