import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  role: "admin" | "user";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
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
