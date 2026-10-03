import { createAdminClient } from "@/lib/supabase/admin";

/** Returns the AdSense slot ID for a placement, or null (AdSlot then shows a labeled placeholder). */
export async function getAdSlotId(placement: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("ad_configs")
      .select("slot_id")
      .eq("placement", placement)
      .eq("type", "adsense")
      .eq("enabled", true)
      .single();
    return data?.slot_id ?? null;
  } catch {
    return null;
  }
}
