/**
 * lib/announcement.ts — shared site-announcement shape and defaults.
 *
 * (Moved here from app/api/announcement/route.ts: Next.js route modules may
 * not export extra runtime values, so shared constants live in lib/.)
 */
export interface SiteAnnouncement {
  id: string;
  text: string;
  linkUrl: string;
  enabled: boolean;
}

export const DEFAULT_ANNOUNCEMENT: SiteAnnouncement = {
  id: "default",
  text: "",
  linkUrl: "",
  enabled: false,
};
