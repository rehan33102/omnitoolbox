import { createAdminClient } from "@/lib/supabase/admin";
import { mergeTools, getEnabledTools } from "@/lib/tools-registry";
import type { Tool } from "@/types";

export async function getPublicTools(): Promise<Tool[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("tools").select("*");
    if (!data) return getEnabledTools();
    return mergeTools(data).filter((t) => t.enabled);
  } catch {
    return getEnabledTools();
  }
}
