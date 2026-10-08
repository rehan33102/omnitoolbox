"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { adMatchesPage } from "@/lib/ad-pages";
import {
  AD_DEFAULTS,
  type AdAnimation,
  type AdFrequency,
  type AdPosition,
  type AdBackdrop,
  type AdDevices,
} from "@/lib/ad-options";
import {
  adScheduleActive,
  adDeviceMatches,
  adDayString,
  adSessionDismissKey,
  adDayDismissKey,
} from "@/lib/ad-targeting";

/**
 * AdPopup — self-contained promo popup, completely separate from the
 * (silent) AutoUpdater. Renders the ad image; click on the card opens the
 * destination link in a new tab.
 *
 * Rotation: every page load picks a RANDOM ad from all enabled ads matching
 * the current route, viewport, schedule window and frequency rules, so
 * visitors see different ads across loads.
 * Ads never render on /admin routes.
 *
 * Per-ad options (all optional, backward-compatible defaults):
 * - showDelaySec: seconds after page load before the popup appears (0 = immediate)
 * - frequency: "session" = once per session (sessionStorage) · "page" = every
 *   page view · "day" = once per calendar day (localStorage day key)
 * - position: "center" = modal · "bottom-right"/"bottom-left" = corner card
 * - backdrop: "dim" | "blur" | "none"
 * - closeDelaySec: X button hidden until N seconds elapsed (0 = immediate)
 * - devices: "all" | "mobile" (≤767px) | "desktop" (≥768px)
 * - scheduleStart/scheduleEnd: ISO datetimes; ad only served inside the window
 *   (also enforced server-side in /api/ads/active)
 */

interface ActiveAd {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  animation: AdAnimation;
  durationSec: number;
  pages: string[];
  showDelaySec: number;
  frequency: AdFrequency;
  position: AdPosition;
  backdrop: AdBackdrop;
  closeDelaySec: number;
  devices: AdDevices;
  scheduleStart: string | null;
  scheduleEnd: string | null;
}

export default function AdPopup() {
  const pathname = usePathname();
  const [ad, setAd] = useState<ActiveAd | null>(null);
  const [shown, setShown] = useState(false);
  const [canClose, setCanClose] = useState(false);

  // Pick an ad on every navigation: eligible = route match + frequency
  // dismissal keys + device target + schedule window, then random pick.
  useEffect(() => {
    // Always reset first: on SPA navigation onto an excluded route (auth,
    // admin), an already-selected ad from the previous page must disappear
    // immediately — otherwise it leaks over the login/signup form and its
    // card swallows every tap ("nothing happens" bug).
    setAd(null);
    setShown(false);
    // Ads are for website visitors only — never render inside the admin.
    const p = pathname ?? "/";
    if (p.startsWith("/admin")) return;
    // Auth pages must stay fully interactive — an overlay must never be able
    // to swallow taps on login/signup buttons (reported dead on app + web).
    if (p === "/login" || p === "/signup" || p.startsWith("/auth")) return;
    let cancelled = false;
    (async () => {
      try {
        // no-store: the feed must never serve a cached (deleted) ad.
        const res = await fetch("/api/ads/active", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const ads: ActiveAd[] = json.ads ?? [];
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const today = adDayString();
        const eligible = ads.filter((a) => {
          if (!a || !adMatchesPage(a.pages, p)) return false;
          const frequency = a.frequency ?? AD_DEFAULTS.frequency;
          if (frequency === "session") {
            try {
              if (sessionStorage.getItem(adSessionDismissKey(a.id))) return false;
            } catch {
              /* storage may be unavailable — treat as not dismissed */
            }
          } else if (frequency === "day") {
            try {
              if (localStorage.getItem(adDayDismissKey(a.id)) === today) return false;
            } catch {
              /* storage may be unavailable — treat as not dismissed */
            }
          }
          // "page": never excluded — shows on every page view.
          if (!adDeviceMatches(a.devices ?? AD_DEFAULTS.devices, isMobile)) return false;
          // Belt-and-suspenders: the feed already filters schedule windows
          // server-side, but a cached response must never leak an ad.
          if (!adScheduleActive(a.scheduleStart, a.scheduleEnd)) return false;
          return true;
        });
        const match =
          eligible.length > 0
            ? eligible[Math.floor(Math.random() * eligible.length)]
            : undefined;
        if (!cancelled && match) setAd(match);
      } catch {
        /* never break the site for an ad */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Delayed appearance: wait showDelaySec after page load before showing.
  useEffect(() => {
    if (!ad) {
      setShown(false);
      return;
    }
    const delayMs =
      Math.min(Math.max(ad.showDelaySec ?? AD_DEFAULTS.showDelaySec, 0), 300) * 1000;
    if (delayMs <= 0) {
      setShown(true);
      return;
    }
    setShown(false);
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [ad]);

  // Close delay: the X button (and backdrop click) stay disabled until
  // closeDelaySec have elapsed since the ad became visible.
  useEffect(() => {
    if (!ad || !shown) {
      setCanClose(false);
      return;
    }
    const delayMs =
      Math.min(Math.max(ad.closeDelaySec ?? AD_DEFAULTS.closeDelaySec, 0), 120) * 1000;
    if (delayMs <= 0) {
      setCanClose(true);
      return;
    }
    setCanClose(false);
    const t = setTimeout(() => setCanClose(true), delayMs);
    return () => clearTimeout(t);
  }, [ad, shown]);

  // Auto-dismiss after the ad's duration, counted from when it appeared.
  useEffect(() => {
    if (!ad || !shown) return;
    const ms = Math.min(Math.max(ad.durationSec, 5), 600) * 1000;
    const t = setTimeout(() => {
      setAd(null);
      setShown(false);
    }, ms);
    return () => clearTimeout(t);
  }, [ad, shown]);

  if (!ad || !shown) return null;
  // Safety net: ads must never render on admin/auth routes, even if state raced.
  const rp = pathname ?? "/";
  if (rp.startsWith("/admin") || rp === "/login" || rp === "/signup" || rp.startsWith("/auth"))
    return null;

  const frequency = ad.frequency ?? AD_DEFAULTS.frequency;
  const position = ad.position ?? AD_DEFAULTS.position;
  const backdrop = ad.backdrop ?? AD_DEFAULTS.backdrop;
  const isCenter = position === "center";

  const close = () => {
    try {
      if (frequency === "session") {
        sessionStorage.setItem(adSessionDismissKey(ad.id), "1");
      } else if (frequency === "day") {
        localStorage.setItem(adDayDismissKey(ad.id), adDayString());
      }
      // "page": no persistence — X only closes this view; the ad may show
      // again on the next page view.
    } catch {
      /* storage may be unavailable — fall through */
    }
    setAd(null);
    setShown(false);
  };

  const openLink = () => {
    window.open(ad.linkUrl, "_blank", "noopener");
    close();
  };

  const backdropClass =
    backdrop === "dim" ? "bg-black/60" : backdrop === "blur" ? "backdrop-blur-[2px]" : "";

  const cardClass = `otb-ad-anim-${ad.animation} relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 cursor-pointer ${
    isCenter
      ? "w-full max-w-sm sm:max-w-md"
      : "w-72 sm:w-80 max-w-[calc(100vw-2rem)]"
  }`;

  const closeButton = canClose ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        close();
      }}
      aria-label="Close ad"
      className="absolute top-2 right-2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-black/60 text-white hover:bg-black/80 active:bg-black/90 transition"
    >
      <X size={22} strokeWidth={2.5} />
    </button>
  ) : null;

  const card = (
    <div className={cardClass} onClick={openLink}>
      {closeButton}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ad.imageUrl}
        alt={ad.name}
        className={`block w-full h-auto object-contain select-none ${
          isCenter ? "max-h-[70vh]" : "max-h-[40vh]"
        }`}
        draggable={false}
      />
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes otb-ad-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes otb-ad-slide-up { from { opacity: 0; transform: translateY(48px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes otb-ad-slide-down { from { opacity: 0; transform: translateY(-48px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes otb-ad-slide-in-right { from { opacity: 0; transform: translateX(64px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes otb-ad-slide-in-left { from { opacity: 0; transform: translateX(-64px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes otb-ad-zoom { from { opacity: 0; transform: scale(.82); } to { opacity: 1; transform: scale(1); } }
        @keyframes otb-ad-bounce { 0% { opacity: 0; transform: scale(.6); } 55% { opacity: 1; transform: scale(1.06); } 75% { transform: scale(.97); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes otb-ad-flip-in { from { opacity: 0; transform: perspective(900px) rotateY(-80deg) scale(.94); } to { opacity: 1; transform: perspective(900px) rotateY(0deg) scale(1); } }
        @keyframes otb-ad-rotate-in { from { opacity: 0; transform: rotate(-14deg) scale(.78); } to { opacity: 1; transform: rotate(0deg) scale(1); } }
        @keyframes otb-ad-pop { 0% { opacity: 0; transform: scale(.5); } 60% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes otb-ad-elastic { 0% { opacity: 0; transform: scale(.4); } 55% { opacity: 1; transform: scale(1.14); } 75% { transform: scale(.95); } 90% { transform: scale(1.03); } 100% { opacity: 1; transform: scale(1); } }
        .otb-ad-anim-fade { animation: otb-ad-fade .35s ease-out both; }
        .otb-ad-anim-slide-up { animation: otb-ad-slide-up .45s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-slide-down { animation: otb-ad-slide-down .45s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-slide-in-right { animation: otb-ad-slide-in-right .45s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-slide-in-left { animation: otb-ad-slide-in-left .45s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-zoom { animation: otb-ad-zoom .4s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-bounce { animation: otb-ad-bounce .6s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-flip-in { animation: otb-ad-flip-in .55s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-rotate-in { animation: otb-ad-rotate-in .5s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-pop { animation: otb-ad-pop .4s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-elastic { animation: otb-ad-elastic .65s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {isCenter ? (
        <div
          // Non-blocking overlay: the backdrop NEVER intercepts pointer events.
          // Only the ad card itself is clickable — a stuck/invisible overlay can
          // no longer swallow taps on the page behind it (the dead-buttons bug).
          className={`pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-4 ${backdropClass}`}
          role="dialog"
          aria-label={ad.name}
        >
          <div className="pointer-events-auto">
            {card}
          </div>
        </div>
      ) : (
        <>
          {/* Corner cards need no full-screen overlay — only a subtle
              backdrop layer when the ad asks for one. Non-interactive so it
              can never block page taps. */}
          {backdrop !== "none" && (
            <div
              className={`pointer-events-none fixed inset-0 z-[80] ${
                backdrop === "dim" ? "bg-black/40" : "backdrop-blur-[2px]"
              }`}
              aria-hidden="true"
            />
          )}
          <div
            className={`fixed z-[90] bottom-4 ${
              position === "bottom-right" ? "right-4" : "left-4"
            }`}
            role="dialog"
            aria-label={ad.name}
          >
            {card}
          </div>
        </>
      )}
    </>
  );
}
