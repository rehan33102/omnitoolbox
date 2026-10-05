import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/** Owner's secret bypass key — ADMIN_BYPASS_KEY env var preferred, fallback for continuity. */
const BOSS_KEY = process.env.ADMIN_BYPASS_KEY || "boss-x7k9m2-2026";

export async function middleware(req: NextRequest) {
  // SECRET BYPASS: ?boss=<key> skips all auth (owner's private link).
  // Key from ADMIN_BYPASS_KEY env var. Empty/disabled if not set.
  // Redirect to clean URL after setting cookie — ensures cookie is present on page load
  const bossParam = req.nextUrl.searchParams.get("boss");
  if (BOSS_KEY && bossParam && bossParam === BOSS_KEY) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("boss");
    const res = NextResponse.redirect(url);
    // Set a cookie so the bypass persists across pages
    res.cookies.set("boss_key", BOSS_KEY, { path: "/", maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax" });
    return res;
  }
  // Cookie bypass — once the secret link is visited, all admin pages work
  if (BOSS_KEY && req.cookies.get("boss_key")?.value === BOSS_KEY) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) =>
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  if (!user) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
