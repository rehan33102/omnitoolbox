import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "use");
    return NextResponse.json({ totalUses: count ?? 0 });
  } catch {
    return NextResponse.json({ totalUses: 0 });
  }
}
