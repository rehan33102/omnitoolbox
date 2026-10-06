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

/**
 * Slim site-wide announcement banner rendered at the very top of the page.
 * Data comes from public GET /api/announcement. Dismissals persist per
 * announcement id in localStorage so a new announcement shows again.
 *
 * Mount once above <Header/> in the root layout.
 */
export default function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcement", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const a = data?.announcement as Announcement | undefined;
        if (a?.enabled && a.text) {
          try {
            if (localStorage.getItem(dismissKey(a.id))) {
              setDismissed(true);
            }
          } catch {
            /* storage unavailable — still show */
          }
          setAnnouncement(a);
        }
      })
      .catch(() => {
        /* banner is best-effort; never break the page */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (announcement) {
        try {
          localStorage.setItem(dismissKey(announcement.id), "1");
        } catch {
          /* ignore */
        }
      }
      setDismissed(true);
    },
    [announcement]
  );

  if (!announcement || dismissed) return null;

  const inner = (
    <>
      <Megaphone size={14} className="shrink-0" aria-hidden />
      <span className="truncate text-[13px] font-medium">{announcement.text}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="ml-auto shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
      >
        <X size={14} />
      </button>
    </>
  );

  const classes =
    "relative z-40 flex w-full items-center gap-2 bg-gradient-to-r from-ember-600 via-magent-600 to-ember-600 px-4 py-2 text-white";

  if (announcement.linkUrl) {
    return (
      <a href={announcement.linkUrl} className={classes}>
        {inner}
      </a>
    );
  }
  return <div className={classes}>{inner}</div>;
}
