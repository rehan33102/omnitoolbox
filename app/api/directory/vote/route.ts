import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  slug: z.string().min(1).max(80),
  viewer: z.string().min(1).max(64),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`vote:${ip}`, 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const supabase = createAdminClient();
    const { data: tool } = await supabase
      .from("ai_tools")
      .select("id, votes")
      .eq("slug", body.data.slug)
      .single();
    if (!tool) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase
      .from("ai_tool_votes")
      .insert({ tool_id: tool.id, viewer: body.data.viewer });
    if (error) return NextResponse.json({ error: "Already voted" }, { status: 409 });

    await supabase.from("ai_tools").update({ votes: tool.votes + 1 }).eq("id", tool.id);
    return NextResponse.json({ ok: true, votes: tool.votes + 1 });
  } catch {
    return NextResponse.json({ error: "Vote failed" }, { status: 500 });
  }
}
