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
    // Filter out NULL updated_at (Postgres sorts NULLs first in DESC order,
    // which would return stale legacy rows instead of the latest write).
    const { data, error } = await supabase
      .from("seo_settings")
      .select("value")
      .eq("key", key)
      .not("updated_at", "is", null)
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

/** Write a JSON value by key. Returns true on success.
 *
 * Self-healing: after the delete+insert, reads back ALL rows for the key.
 * If duplicates exist (legacy rows, concurrent writers), wipes them and
 * re-inserts exactly one row, then verifies the read-back matches. Returns
 * true only when the store holds exactly one row with our value — so a
 * "success" can never leave the public feed serving stale data.
 */
export async function setKV(key: string, value: unknown): Promise<boolean> {
  const payload = JSON.stringify(value);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const supabase = createAdminClient();
      // Delete-then-insert instead of upsert: robust even if legacy duplicate
      // rows exist for this key (upsert without a matching unique constraint
      // can silently no-op, which was the "branding save fails" bug).
      const del = await supabase.from("seo_settings").delete().eq("key", key);
      if (del.error) return false;
      const { error } = await supabase.from("seo_settings").insert({
        key,
        value: payload,
        updated_at: new Date().toISOString(),
      });
      if (error) return false;
      // Verify: exactly one row for this key, holding our payload.
      const check = await supabase
        .from("seo_settings")
        .select("value")
        .eq("key", key);
      if (check.error) return false;
      const rows = Array.isArray(check.data) ? check.data : [];
      if (rows.length === 1 && rows[0]?.value === payload) return true;
      // Duplicates or mismatch — loop once more to wipe + rewrite cleanly.
    } catch {
      return false;
    }
  }
  return false;
}

/** Delete every row for a key. Returns true when no rows remain. */
export async function deleteKV(key: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const del = await supabase.from("seo_settings").delete().eq("key", key);
    if (del.error) return false;
    const check = await supabase
      .from("seo_settings")
      .select("key")
      .eq("key", key)
      .limit(1);
    if (check.error) return false;
    const rows = Array.isArray(check.data) ? check.data : [];
    return rows.length === 0;
  } catch {
    return false;
  }
}

/** Read a JSON value by key plus the row's updated_at (for cache-busting
 * headers / diagnostics). Returns fallback + null stamp when missing. */
export async function getKVWithMeta<T>(
  key: string,
  fallback: T
): Promise<{ value: T; updatedAt: string | null }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("seo_settings")
      .select("value, updated_at")
      .eq("key", key)
      .not("updated_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row?.value) return { value: fallback, updatedAt: null };
    try {
      return {
        value: JSON.parse(row.value) as T,
        updatedAt: row.updated_at ?? null,
      };
    } catch {
      return { value: fallback, updatedAt: null };
    }
  } catch {
    return { value: fallback, updatedAt: null };
  }
}

/** Read a JSON value by key using the simplest possible query shape
 * (no null-filter, no limit — take the newest row in JS). This matches the
 * diagnostic query that provably returns correct data in production.
 * Used for branding where the ordered/limited query shape returned stale rows.
 */
export async function getKVSimple<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("seo_settings")
      .select("value, updated_at")
      .eq("key", key)
      .order("updated_at", { ascending: false });
    if (error || !Array.isArray(data) || data.length === 0) return fallback;
    // Pick the newest non-null updated_at row in JS (deterministic).
    const valid = data.filter((r) => r?.updated_at != null && r?.value != null);
    const row = valid.length > 0 ? valid[0] : data[0];
    if (!row?.value) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  } catch {
    return fallback;
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
      .not("updated_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row?.value) return null;
    return row.value;
  } catch {
    return null;
  }
}
