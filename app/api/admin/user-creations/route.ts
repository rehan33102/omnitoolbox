import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const email = req.nextUrl.searchParams.get("email");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 200);

  if (!userId && !email) {
    return NextResponse.json({ error: "userId or email required" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("user_creations")
      .select("id, kind, name, tool_slug, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (email) {
      query = query.eq("user_email", email);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Counts by kind
    const counts: Record<string, number> = {};
    for (const c of data ?? []) {
      counts[c.kind] = (counts[c.kind] ?? 0) + 1;
    }

    return NextResponse.json({ creations: data ?? [], counts, total: data?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
