"use client";

import { useEffect, useRef } from "react";

/**
 * AutoUpdater — completely silent automatic updates.
 *
 * Polls /api/site-version every 15 minutes. When a new version is detected,
 * it waits until the tab is HIDDEN (user not looking) then silently reloads.
 * User never sees any prompt, banner, or interruption. The app just stays updated.
 */
export default function AutoUpdater() {
  const firstVersion = useRef<string | null>(null);
  const pendingUpdate = useRef(false);

  useEffect(() => {
    const doReload = async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        await reg?.update();
      } catch {
        /* non-critical */
      }
      window.location.reload();
    };

    const check = async () => {
      try {
        const r = await fetch("/api/site-version", { cache: "no-store" });
        if (!r.ok) return;
        const { version } = await r.json();
        if (!version || version === "unknown") return;

        if (firstVersion.current === null) {
          firstVersion.current = version;
          return;
        }
        if (firstVersion.current !== version && !pendingUpdate.current) {
          pendingUpdate.current = true;
          // If tab is hidden, reload right away (user won't notice)
          // Otherwise wait until they leave the tab
          if (document.visibilityState === "hidden") {
            doReload();
          }
        }
      } catch {
        /* network hiccup — try again next poll */
      }
    };

    // When tab becomes hidden and an update is pending, reload silently
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && pendingUpdate.current) {
        doReload();
      }
    };

    // Check every 15 minutes
    const timer = setInterval(check, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisibility);
    // First check 30s after load (establishes baseline)
    const initial = setTimeout(check, 30000);

    return () => {
      clearInterval(timer);
      clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
