/**
 * lib/activity.ts — admin activity log.
 *
 * Appends entries to the `activity_log` KV key (seo_settings table), capped at
 * the 300 most recent entries. SERVER-ONLY (uses service-role via lib/kv).
 *
 * Usage in admin API routes:
 *   import { logActivity } from "@/lib/activity";
 *   await logActivity("ad.created", `Popup ad "${name}" created`, userEmail);
 */
import { getKV, setKV } from "@/lib/kv";

export interface ActivityEntry {
  id: string;
  ts: string; // ISO timestamp
  action: string; // e.g. "ad.created", "branding.updated"
  detail: string; // human-readable summary
  actor: string; // admin email or "system"
}

const KEY = "activity_log";
const MAX_ENTRIES = 300;

export async function logActivity(
  action: string,
  detail: string,
  actor = "admin"
): Promise<void> {
  try {
    const entries = await getKV<ActivityEntry[]>(KEY, []);
    entries.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      action,
      detail: detail.slice(0, 500),
      actor: actor.slice(0, 120),
    });
    await setKV(KEY, entries.slice(0, MAX_ENTRIES));
  } catch {
    /* activity logging must never break the admin action */
  }
}

export async function getActivity(limit = 100): Promise<ActivityEntry[]> {
  const entries = await getKV<ActivityEntry[]>(KEY, []);
  return entries.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}
