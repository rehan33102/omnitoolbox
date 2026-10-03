import { NextResponse } from "next/server";
import { TOOLS, mergeTools } from "@/lib/tools-registry";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("tools").select("*");
    const tools = mergeTools(data ?? []).filter((t) => t.enabled);
    return NextResponse.json({ tools });
  } catch {
    return NextResponse.json({ tools: TOOLS.filter((t) => t.enabled) });
  }
}
