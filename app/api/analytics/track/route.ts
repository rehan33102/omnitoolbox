import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  toolSlug: z.string().min(1).max(80),
  action: z.string().max(40).default("use"),
  viewer: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (!rateLimit(`track:${ip}:${body.data.toolSlug}`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    const supabase = createAdminClient();
    await supabase.from("analytics_events").insert({
      tool_slug: body.data.toolSlug,
      action: body.data.action,
      viewer: body.data.viewer ?? null,
    });
  } catch {
    /* analytics must never break UX */
  }
  return NextResponse.json({ ok: true });
}
