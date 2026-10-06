import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  toolSlug: z.string().min(1).max(80),
  action: z.string().max(40).default("use"),
  viewer: z.string().max(64).optional(),
  // Opt-in precise location (visitor explicitly granted browser geolocation
  // permission via the OS dialog — never collected silently).
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // Identity linkage (only when the visitor is logged in; null = anonymous).
  userId: z.string().max(64).optional(),
  userEmail: z.string().max(160).optional(),
  userName: z.string().max(120).optional(),
});

/**
 * Privacy: coarse IP-based geolocation only (country + city from Vercel's
 * geo headers — same approach as Google Analytics / Vercel Analytics).
 * NEVER browser GPS — no permission prompt is ever shown to the visitor.
 * Full IP addresses are not stored.
 */
function geoFromHeaders(req: NextRequest): { country: string | null; city: string | null } {
  const country = req.headers.get("x-vercel-ip-country")?.trim() || null;
  let city: string | null = null;
  try {
    const raw = req.headers.get("x-vercel-ip-city");
    city = raw ? decodeURIComponent(raw).slice(0, 80) : null;
  } catch {
    city = null;
  }
  return { country, city };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (!rateLimit(`track:${ip}:${body.data.toolSlug}`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    const supabase = createAdminClient();
    const { country, city } = geoFromHeaders(req);
    const row: Record<string, unknown> = {
      tool_slug: body.data.toolSlug,
      action: body.data.action,
      viewer: body.data.viewer ?? null,
    };
    // country/city columns exist after migration 013 (setup SQL). Try with
    // geo first; if the columns don't exist yet, retry without them so the
    // base event is never lost.
    const { lat, lng, userId, userEmail, userName } = body.data;
    const hasPrecise = typeof lat === "number" && typeof lng === "number";
    const hasIdentity = typeof userId === "string" && userId.length > 0;
    if (country || city || hasPrecise || hasIdentity) {
      if (country) row.country = country;
      if (city) row.city = city;
      if (hasPrecise) {
        row.latitude = lat;
        row.longitude = lng;
      }
      if (hasIdentity) {
        row.user_id = userId;
        if (userEmail) row.user_email = userEmail.slice(0, 160);
        if (userName) row.user_name = userName.slice(0, 120);
      }
      const { error } = await supabase.from("analytics_events").insert(row);
      if (!error) return NextResponse.json({ ok: true });
      delete row.country;
      delete row.city;
      delete row.latitude;
      delete row.longitude;
      delete row.user_id;
      delete row.user_email;
      delete row.user_name;
    }
    await supabase.from("analytics_events").insert(row);
  } catch {
    /* analytics must never break UX */
  }
  return NextResponse.json({ ok: true });
}
