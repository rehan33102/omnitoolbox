"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  SETTINGS_UPDATED_EVENT,
  loadSiteSettings,
  saveSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings";

/**
 * useSiteSettings — site identity + social links, live-synced across components.
 * Defaults render on the server (SSR-safe); stored values load on mount and
 * every save dispatches a window event so Header/Footer/WhatsApp float update
 * instantly without a reload.
 */
export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSiteSettings().then((s) => {
      if (alive) {
        setSettings(s);
        setLoaded(true);
      }
    });
    const onUpdate = (e: Event) => setSettings((e as CustomEvent<SiteSettings>).detail);
    window.addEventListener(SETTINGS_UPDATED_EVENT, onUpdate);
    // Cross-tab: localStorage mirror fires a storage event in other tabs.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "otb:named:settings:site") loadSiteSettings().then((s) => alive && setSettings(s));
    };
    window.addEventListener("storage", onStorage);
    return () => {
      alive = false;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const updateSettings = useCallback(async (partial: Partial<SiteSettings>) => {
    const next = await saveSiteSettings(partial);
    setSettings(next);
    return next;
  }, []);

  return { settings, loaded, updateSettings };
}
