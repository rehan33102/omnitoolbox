"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

interface Announcement {
  id: string;
  text: string;
  linkUrl: string;
  enabled: boolean;
}

function dismissKey(id: string) {
  return `otb-announcement-dismissed-${id}`;
}

function isDismissed(id: string): boolean {
  try {
    return !!localStorage.getItem(dismissKey(id));
  } catch {
    return false;
  }
}

/**
 * Slim site-wide announcement banners rendered at the very top of the page.
 * Data comes from public GET /api/announcement (enabled only, newest first).
 * All enabled announcements render STACKED — each slim, each with its own X.
 * Dismissals persist per announcement id in localStorage, so dismissing one
 * never hides the others, and a newly added announcement shows again.
 *
 * Mount once above <Header/> in the root layout.
 */
export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcement", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = data?.announcements;
        if (Array.isArray(list)) {
          setAnnouncements(
            list.filter((a) => a?.enabled && a.text && !isDismissed(a.id))
          );
        }
      })
      .catch(() => {
        /* banner is best-effort; never break the page */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    try {
      localStorage.setItem(dismissKey(id), "1");
    } catch {
      /* ignore */
    }
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }, []);

  if (announcements.length === 0) return null;

  const classes =
    "relative z-40 flex w-full items-center gap-2 bg-gradient-to-r from-ember-600 via-magent-600 to-ember-600 px-4 py-2 text-white";

  return (
    <>
      {announcements.map((a) => {
        const inner = (
          <>
            <Megaphone size={14} className="shrink-0" aria-hidden />
            <span className="truncate text-[13px] font-medium">{a.text}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                dismiss(a.id);
              }}
              aria-label="Dismiss announcement"
              className="ml-auto shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
            >
              <X size={14} />
            </button>
          </>
        );
        return a.linkUrl ? (
          <a key={a.id} href={a.linkUrl} className={classes}>
            {inner}
          </a>
        ) : (
          <div key={a.id} className={classes}>
            {inner}
          </div>
        );
      })}
    </>
  );
}
