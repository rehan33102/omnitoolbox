"use client";

import { useCallback, useEffect, useState } from "react";
import { Wrench, X } from "lucide-react";

const DISMISS_KEY = "otb-maintenance-dismissed";

/**
 * Site-wide maintenance banner. Shows when admin enables maintenance mode
 * via /api/admin/maintenance. Professional styling, no emoji.
 * Dismissible per session; reappears on next visit if still enabled.
 * Mount once above <Header/> in the root layout, below AnnouncementBar.
 */
export default function MaintenanceBanner() {
  const [enabled, setEnabled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Per-session dismiss (not permanent — maintenance is temporary).
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
    fetch("/api/maintenance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.enabled) setEnabled(true);
      })
      .catch(() => {
        /* banner is best-effort; never break the page */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (!enabled || dismissed) return null;

  return (
    <div
      role="status"
      aria-label="Website on maintenance"
      className="relative z-40 flex w-full items-center gap-2 bg-amber-500 px-4 py-2 text-black"
    >
      <Wrench size={14} className="shrink-0" aria-hidden />
      <span className="truncate text-[13px] font-semibold">
        Website on maintenance — we are improving things, back shortly.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss maintenance notice"
        className="ml-auto shrink-0 rounded-full p-1 hover:bg-black/10 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
