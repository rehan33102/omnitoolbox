"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AutoUpdater — notifies users of new versions WITHOUT disrupting them.
 *
 * Polls /api/site-version every 15 minutes. When a new version is detected,
 * shows a subtle bottom banner with a "Refresh" button instead of force-reloading.
 * User chooses when to update.
 */
export default function AutoUpdater() {
  const firstVersion = useRef<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const check = async () => {
      if (showBanner) return;
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
          // New version available — show banner, don't force reload
          setShowBanner(true);
        }
      } catch {
        /* network hiccup — try again next poll */
      }
    };

    // Check every 15 minutes (less aggressive than 5)
    timer = setInterval(check, 15 * 60 * 1000);
    // Check when user returns to the tab
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    // First check 30s after load (establishes baseline)
    const initial = setTimeout(check, 30000);

    return () => {
      clearInterval(timer);
      clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [showBanner]);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xl border border-black/10">
      <span className="text-sm font-medium">New version available</span>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:opacity-90 transition"
      >
        Refresh
      </button>
      <button
        onClick={() => setShowBanner(false)}
        aria-label="Dismiss update notification"
        className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition opacity-70"
      >
        {"\u2715"}
      </button>
    </div>
  );
}
