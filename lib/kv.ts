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
    // Take the latest row explicitly: never use maybeSingle() here, because
    // legacy duplicate rows (from before the PK constraint) make it throw
    // and silently return the fallback — that was the "branding save fails" bug.
    const { data, error } = await supabase
      .from("seo_settings")
      .select("value")
      .eq("key", key)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row?.value) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  } catch {
    return fallback;
  }
}

/** Write a JSON value by key. Returns true on success. */
export async function setKV(key: string, value: unknown): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    // Delete-then-insert instead of upsert: robust even if legacy duplicate
    // rows exist for this key (upsert without a matching unique constraint
    // can silently no-op, which was the "branding save fails" bug).
    const del = await supabase.from("seo_settings").delete().eq("key", key);
    if (del.error) return false;
    const { error } = await supabase.from("seo_settings").insert({
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString(),
    });
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
