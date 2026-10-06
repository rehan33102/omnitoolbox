/**
 * lib/kv.ts — tiny key-value store backed by the existing `seo_settings` table.
 *
 * Why: new tables need DDL that cannot run from the app (no exec_sql RPC in
 * production). `seo_settings(key text pk, value text)` already exists and is
 * proven working in production (used by /api/admin/seo/regenerate).
 *
 * SERVER-ONLY: uses the service-role client. Never import into client components.
 * Public reads go through dedicated API routes (e.g. /api/ads/active).
 */
import { createAdminClient } from "@/lib/supabase/admin";

/** Read a JSON value by key. Returns `fallback` when missing/unparseable. */
export async function getKV<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("seo_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data?.value) return fallback;
    try {
      return JSON.parse(data.value) as T;
    } catch {
      return fallback;
    }
  } catch {
    return fallback;
  }
}

/** Write a JSON value by key (upsert). Returns true on success. */
export async function setKV(key: string, value: unknown): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("seo_settings")
      .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
}

/** Raw string read (for non-JSON values like timestamps). */
export async function getKVRaw(key: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("seo_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data?.value) return null;
    return data.value;
  } catch {
    return null;
  }
}
