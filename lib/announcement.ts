/**
 * lib/announcement.ts — shared site-announcement shape, defaults, and
 * list storage helpers.
 *
 * (Moved here from app/api/announcement/route.ts: Next.js route modules may
 * not export extra runtime values, so shared constants live in lib/.)
 *
 * SERVER-ONLY: uses the KV store (service-role client). Never import into
 * client components. Public reads go through /api/announcement.
 */
import { getKV, setKV } from "@/lib/kv";

export interface SiteAnnouncement {
  id: string;
  text: string;
  linkUrl: string;
  enabled: boolean;
  /** ISO timestamp of creation; used for newest-first ordering. */
  createdAt?: string;
}

/** Legacy single-announcement default (pre-list era). Kept for reference. */
export const DEFAULT_ANNOUNCEMENT: SiteAnnouncement = {
  id: "default",
  text: "",
  linkUrl: "",
  enabled: false,
};

/** New list key. Legacy key stays untouched as a backup after migration. */
export const ANNOUNCEMENTS_KEY = "site_announcements";
const LEGACY_KEY = "site_announcement";
const MIGRATED_FLAG = "site_announcements_migrated";

function sanitize(a: SiteAnnouncement): SiteAnnouncement {
  return {
    id: String(a.id ?? `ann-${Date.now()}`),
    text: String(a.text ?? "").slice(0, 200),
    linkUrl: String(a.linkUrl ?? ""),
    enabled: !!a.enabled,
    createdAt: a.createdAt ?? new Date(0).toISOString(),
  };
}

/**
 * Load the full announcement list (newest first). Runs the one-time
 * migration from the legacy single object: if the list key was never
 * populated, the legacy announcement (if it has text) becomes the first
 * list item. A migration flag prevents resurrection after the user deletes
 * everything.
 */
export async function getAnnouncements(): Promise<SiteAnnouncement[]> {
  const raw = await getKV<SiteAnnouncement[]>(ANNOUNCEMENTS_KEY, []);
  const list = Array.isArray(raw) ? raw.map(sanitize) : [];
  if (list.length > 0) {
    return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }
  const migrated = await getKV<boolean>(MIGRATED_FLAG, false);
  if (migrated) return [];
  const legacy = await getKV<SiteAnnouncement | null>(LEGACY_KEY, null);
  const out: SiteAnnouncement[] =
    legacy && String(legacy.text ?? "").trim()
      ? [
          sanitize({
            ...legacy,
            text: String(legacy.text).trim(),
            createdAt: legacy.createdAt ?? new Date().toISOString(),
          }),
        ]
      : [];
  await setKV(ANNOUNCEMENTS_KEY, out);
  await setKV(MIGRATED_FLAG, true);
  return out;
}

/** Persist the full list. Single-key write = atomic at the KV level. */
export async function saveAnnouncements(list: SiteAnnouncement[]): Promise<boolean> {
  const clean = list.map(sanitize);
  const ok = await setKV(ANNOUNCEMENTS_KEY, clean);
  if (ok) await setKV(MIGRATED_FLAG, true);
  return ok;
}

/** Public view: enabled announcements with text, newest first. */
export function publicAnnouncements(list: SiteAnnouncement[]): SiteAnnouncement[] {
  return list
    .filter((a) => a.enabled && a.text.trim().length > 0)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
