"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { adMatchesPage } from "@/lib/ad-pages";

/**
 * AdPopup — self-contained promo popup, completely separate from the
 * (silent) AutoUpdater. Renders a centered modal with the ad image; click
 * anywhere on the card opens the destination link in a new tab.
 */

interface ActiveAd {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  animation: "fade" | "slide-up" | "slide-in-right" | "zoom" | "bounce";
  durationSec: number;
  pages: string[];
}

export default function AdPopup() {
  const pathname = usePathname();
  const [ad, setAd] = useState<ActiveAd | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ads/active", { cache: "default" });
        if (!res.ok) return;
        const json = await res.json();
        const ads: ActiveAd[] = json.ads ?? [];
        // API returns newest-first; pick the newest enabled ad matching this route.
        const match = ads.find(
          (a) =>
            a &&
            adMatchesPage(a.pages, pathname ?? "/") &&
            !sessionStorage.getItem(`otb-ad-dismissed-${a.id}`)
        );
        if (!cancelled && match) setAd(match);
      } catch {
        /* never break the site for an ad */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Auto-dismiss after the ad's duration.
  useEffect(() => {
    if (!ad) return;
    const ms = Math.min(Math.max(ad.durationSec, 5), 600) * 1000;
    const t = setTimeout(() => {
      dismissedRef.current = true;
      setAd(null);
    }, ms);
    return () => clearTimeout(t);
  }, [ad]);

  if (!ad || dismissedRef.current) return null;

  const close = () => {
    try {
      sessionStorage.setItem(`otb-ad-dismissed-${ad.id}`, "1");
    } catch {
      /* storage may be unavailable — fall through */
    }
    dismissedRef.current = true;
    setAd(null);
  };

  return (
    <>
      <style>{`
        @keyframes otb-ad-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes otb-ad-slide-up { from { opacity: 0; transform: translateY(48px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes otb-ad-slide-in-right { from { opacity: 0; transform: translateX(64px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes otb-ad-zoom { from { opacity: 0; transform: scale(.82); } to { opacity: 1; transform: scale(1); } }
        @keyframes otb-ad-bounce { 0% { opacity: 0; transform: scale(.6); } 55% { opacity: 1; transform: scale(1.06); } 75% { transform: scale(.97); } 100% { opacity: 1; transform: scale(1); } }
        .otb-ad-anim-fade { animation: otb-ad-fade .35s ease-out both; }
        .otb-ad-anim-slide-up { animation: otb-ad-slide-up .45s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-slide-in-right { animation: otb-ad-slide-in-right .45s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-zoom { animation: otb-ad-zoom .4s cubic-bezier(.22,1,.36,1) both; }
        .otb-ad-anim-bounce { animation: otb-ad-bounce .6s cubic-bezier(.22,1,.36,1) both; }
      `}</style>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-label={ad.name}
        onClick={close}
      >
        <div
          className={`otb-ad-anim-${ad.animation} relative w-full max-w-sm sm:max-w-md overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 cursor-pointer`}
          onClick={(e) => {
            e.stopPropagation();
            window.open(ad.linkUrl, "_blank", "noopener");
            close();
          }}
        >
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrl}
            alt={ad.name}
            className="block w-full h-auto max-h-[70vh] object-contain select-none"
            draggable={false}
          />
        </div>
      </div>
    </>
  );
}
