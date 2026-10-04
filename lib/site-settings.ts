/**
 * lib/site-settings.ts — site identity + social links, editable from /admin/settings.
 *
 * Persisted to IndexedDB (records store, kind "settings") + localStorage mirror,
 * so changes apply instantly on every page without a redeploy.
 * Header, Footer, contact page and the WhatsApp float all read from here.
 */
import { getNamedRecord, saveNamedRecord } from "@/lib/db";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoText: string;
  whatsapp: string; // digits only, e.g. 923407560964
  instagram: string;
  tiktok: string;
  github: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: SITE_NAME,
  tagline: SITE_TAGLINE,
  logoText: SITE_NAME,
  whatsapp: "923407560964",
  instagram: "",
  tiktok: "https://www.tiktok.com/@rehan331022",
  github: "https://github.com/rehan33102",
};

export const SETTINGS_KEY = "site";
export const SETTINGS_UPDATED_EVENT = "otb:settings-updated";

export const WHATSAPP_MESSAGE =
  "Assalam o alaikum! I found Omni Tool Box and I'm interested. Can we talk about details?";

/** Digits-only WhatsApp number; falls back to the default when empty/invalid. */
export function normalizeWhatsapp(raw: string | undefined | null): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : DEFAULT_SETTINGS.whatsapp;
}

export function whatsappUrl(number: string, message: string = WHATSAPP_MESSAGE): string {
  return `https://wa.me/${normalizeWhatsapp(number)}?text=${encodeURIComponent(message)}`;
}

export async function loadSiteSettings(): Promise<SiteSettings> {
  try {
    const stored = await getNamedRecord<Partial<SiteSettings>>("settings", SETTINGS_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

/** Merge + persist settings, then notify all mounted hooks on this tab. */
export async function saveSiteSettings(partial: Partial<SiteSettings>): Promise<SiteSettings> {
  const next: SiteSettings = { ...DEFAULT_SETTINGS, ...(await loadSiteSettings()), ...partial };
  await saveNamedRecord("settings", SETTINGS_KEY, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SiteSettings>(SETTINGS_UPDATED_EVENT, { detail: next }));
  }
  return next;
}
