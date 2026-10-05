import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { TOOLS, mergeTools } from "@/lib/tools-registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardApi } from "@/lib/api-security";

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "api:tools", max: 60, skipOriginCheck: true });
  if (sec) return sec;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("tools").select("*");
    const tools = mergeTools(data ?? []).filter((t) => t.enabled);
    return NextResponse.json({ tools });
  } catch {
    return NextResponse.json({ tools: TOOLS.filter((t) => t.enabled) });
  }
}
