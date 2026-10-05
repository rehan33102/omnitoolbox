"use client";

import { useEffect, useRef } from "react";

/**
 * AutoUpdater — users get every website update WITHOUT doing anything.
 *
 * Polls /api/site-version every 5 minutes. When the deployed git hash changes
 * (meaning a new version was pushed), it:
 *  1. Tells the service worker to check for updates
 *  2. Silently reloads the page so the user is always on the latest version
 *
 * Also re-checks when the tab becomes visible again (user returns to the app).
 */
export default function AutoUpdater() {
  const firstVersion = useRef<string | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const check = async () => {
      if (reloading.current) return;
      try {
        const r = await fetch("/api/site-version", { cache: "no-store" });
        if (!r.ok) return;
        const { version } = await r.json();
        if (!version || version === "unknown") return;

        if (firstVersion.current === null) {
          firstVersion.current = version;
          return;
        }
        if (firstVersion.current !== version) {
          // New version deployed — update service worker then reload
          reloading.current = true;
          try {
            const reg = await navigator.serviceWorker?.getRegistration();
            await reg?.update();
          } catch {
            /* non-critical */
          }
          window.location.reload();
        }
      } catch {
        /* network hiccup — try again next poll */
      }
    };

    // Check every 5 minutes
    timer = setInterval(check, 5 * 60 * 1000);
    // Check when user returns to the tab
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    // First check shortly after load (establishes baseline)
    const initial = setTimeout(check, 10000);

    return () => {
      clearInterval(timer);
      clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
