"use client";

import { useCallback, useEffect, useState } from "react";

export interface Branding {
  siteName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  accentColor: string;
  footerText: string;
  socialX: string;
  socialInstagram: string;
  socialYoutube: string;
  socialTiktok: string;
}

export const DEFAULT_BRANDING: Branding = {
  siteName: "",
  tagline: "",
  logoUrl: "",
  faviconUrl: "",
  accentColor: "",
  footerText: "",
  socialX: "",
  socialInstagram: "",
  socialYoutube: "",
  socialTiktok: "",
};

export const BRANDING_UPDATED_EVENT = "otb:branding-updated";
const CACHE_KEY = "otb-branding";

/** Apply the runtime side-effects of a branding object: accent color CSS
 *  variable + favicon. Safe to call repeatedly; no-ops when fields are empty. */
function applyBrandingSideEffects(b: Branding) {
  if (typeof document === "undefined") return;
  // Accent color: --brand-accent is declared in globals.css (:root) and
  // consumed by .brand-name / ::selection / .text-brand-accent utilities.
  if (b.accentColor) {
    document.documentElement.style.setProperty("--brand-accent", b.accentColor);
  }
  if (b.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (link.href !== b.faviconUrl) link.href = b.faviconUrl;
  }
}

function mergeBranding(raw: unknown): Branding {
  return { ...DEFAULT_BRANDING, ...((raw ?? {}) as Partial<Branding>) };
}

/**
 * useBranding — site branding from Supabase KV (/api/branding), live for all
 * visitors. localStorage mirror gives instant paint on mount; the network
 * fetch then refreshes it. The admin Branding card dispatches
 * BRANDING_UPDATED_EVENT after a save so header/footer update instantly
 * without a reload.
 */
export function useBranding() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [loaded, setLoaded] = useState(false);

  const apply = useCallback((next: Branding) => {
    setBranding(next);
    applyBrandingSideEffects(next);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      /* cache is best-effort */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // Instant paint from the cached copy (may be stale by design).
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const b = mergeBranding(JSON.parse(raw));
        setBranding(b);
        applyBrandingSideEffects(b);
      }
    } catch {
      /* ignore corrupt cache */
    }
    // Fresh copy from KV — the source of truth for every visitor.
    fetch("/api/branding", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        apply(mergeBranding(j));
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });

    // Admin save → instant update on the same tab, no reload.
    const onUpdate = (e: Event) => {
      if (!alive) return;
      apply(mergeBranding((e as CustomEvent<Partial<Branding>>).detail));
      setLoaded(true);
    };
    window.addEventListener(BRANDING_UPDATED_EVENT, onUpdate);
    return () => {
      alive = false;
      window.removeEventListener(BRANDING_UPDATED_EVENT, onUpdate);
    };
  }, [apply]);

  return { branding, loaded };
}
