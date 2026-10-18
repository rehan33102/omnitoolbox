"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Globe, Palette, Bot } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";

const WA_BASE = "https://wa.me/923407560964";

/**
 * RehanTechAds — self-contained REHAN TECH promo popup (2026-10-18 rebuild).
 *
 * Why a fresh component: the old DB-driven <AdPopup/> was hard-disabled in
 * app/layout.tsx on 2026-10-13 because its centered modal covered tool cards
 * and swallowed taps. This rebuild keeps the owner's original spec (3 rotating
 * REHAN TECH service ads, click → WhatsApp) but is deliberately NON-BLOCKING:
 * bottom sheet on mobile / bottom-right card on desktop, no backdrop overlay,
 * pointer events only on the card itself — it can never eat page taps again.
 *
 * Behavior:
 * - Shows ~7s after page load / SPA navigation, on every page except
 *   /admin, /login, /signup, /auth*.
 * - Rotates through the 3 ads round-robin across page views (session).
 * - Frequency cap: once per session per ad — closing (or tapping the CTA)
 *   dismisses that ad for the rest of the session.
 * - Auto-dismisses after ~22s with a smooth exit if ignored.
 * - Animations: spring slide-up entrance, shine sweep on the CTA, gentle
 *   icon float, smooth slide-down/fade exit. Honors prefers-reduced-motion.
 */

interface RehanAd {
  id: string;
  service: string;
  headline: string;
  pitch: string;
  cta: string;
  waText: string;
  icon: "globe" | "palette" | "bot";
}

const ADS: RehanAd[] = [
  {
    id: "rt-web-dev",
    service: "Website Development",
    headline: "Need a website that actually brings customers?",
    pitch:
      "Blazing-fast, modern websites for your business — designed to convert visitors into buyers.",
    cta: "Get My Website",
    waText: "Hi REHAN TECH! I want a new website for my business.",
    icon: "globe",
  },
  {
    id: "rt-web-design",
    service: "Web Design",
    headline: "Make your brand look world-class.",
    pitch:
      "Premium, Figma-grade designs that make customers trust you at first glance.",
    cta: "Get a Design Quote",
    waText: "Hi REHAN TECH! I need a premium design for my brand.",
    icon: "palette",
  },
  {
    id: "rt-automation",
    service: "Automation & AI",
    headline: "Let AI do your repetitive work.",
    pitch:
      "AI chatbots, voice tools & smart workflows that save you hours every single day.",
    cta: "Automate My Work",
    waText: "Hi REHAN TECH! I want to automate my work with AI.",
    icon: "bot",
  },
];

const SHOW_DELAY_MS = 7000;
const AUTO_DISMISS_MS = 22000;
const EXIT_MS = 340;
const IDX_KEY = "rt-ads-idx";
const CLOSED_KEY = "rt-ads-closed";

const ICONS = { globe: Globe, palette: Palette, bot: Bot } as const;

function isExcludedPath(p: string): boolean {
  return (
    p.startsWith("/admin") ||
    p === "/login" ||
    p === "/signup" ||
    p.startsWith("/auth")
  );
}

function readClosed(): string[] {
  try {
    const raw = sessionStorage.getItem(CLOSED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function markClosed(id: string) {
  try {
    const closed = readClosed();
    if (!closed.includes(id)) {
      closed.push(id);
      sessionStorage.setItem(CLOSED_KEY, JSON.stringify(closed));
    }
  } catch {
    /* storage may be unavailable — ad just shows again, harmless */
  }
}

/** Round-robin pick across page views; skips ads closed this session. */
function pickAd(): RehanAd | null {
  const closed = readClosed();
  const candidates = ADS.filter((a) => !closed.includes(a.id));
  if (candidates.length === 0) return null;
  let idx = 0;
  try {
    idx = Number(sessionStorage.getItem(IDX_KEY) || "0") || 0;
  } catch {
    /* ignore */
  }
  const ad = candidates[idx % candidates.length];
  try {
    sessionStorage.setItem(IDX_KEY, String(idx + 1));
  } catch {
    /* ignore */
  }
  return ad;
}

export default function RehanTechAds() {
  const pathname = usePathname();
  const [ad, setAd] = useState<RehanAd | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const dismiss = useCallback(
    (markAsClosed: boolean) => {
      clearTimers();
      if (ad && markAsClosed) markClosed(ad.id);
      setLeaving(true);
      later(() => {
        setAd(null);
        setLeaving(false);
      }, EXIT_MS);
    },
    [ad, clearTimers, later]
  );

  // Pick an ad on every navigation; show it after the delay.
  useEffect(() => {
    clearTimers();
    setAd(null);
    setLeaving(false);
    const p = pathname ?? "/";
    if (isExcludedPath(p)) return;
    const next = pickAd();
    if (!next) return;
    later(() => {
      // Re-check exclusion in case the user navigated during the delay.
      setAd((cur) => cur ?? next);
      later(() => {
        // Auto-dismiss (advances rotation; not marked closed).
        setLeaving(true);
        later(() => {
          setAd(null);
          setLeaving(false);
        }, EXIT_MS);
      }, AUTO_DISMISS_MS);
    }, SHOW_DELAY_MS);
    return clearTimers;
  }, [pathname, clearTimers, later]);

  // Escape closes the ad.
  useEffect(() => {
    if (!ad || leaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ad, leaving, dismiss]);

  if (!ad) return null;

  const Icon = ICONS[ad.icon];
  const waLink = `${WA_BASE}?text=${encodeURIComponent(ad.waText)}`;

  return (
    <>
      <style>{`
        @keyframes rt-ad-in {
          0% { opacity: 0; transform: translateY(56px) scale(.96); }
          60% { opacity: 1; transform: translateY(-6px) scale(1.004); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (min-width: 640px) {
          @keyframes rt-ad-in {
            0% { opacity: 0; transform: translateX(72px) scale(.96); }
            60% { opacity: 1; transform: translateX(-8px) scale(1.004); }
            100% { opacity: 1; transform: translateX(0) scale(1); }
          }
        }
        @keyframes rt-ad-out {
          to { opacity: 0; transform: translateY(28px) scale(.96); }
        }
        @keyframes rt-ad-shine {
          0% { left: -70%; }
          55%, 100% { left: 135%; }
        }
        @keyframes rt-ad-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .rt-ad-enter { animation: rt-ad-in .6s cubic-bezier(.34,1.35,.5,1) both; }
        .rt-ad-exit { animation: rt-ad-out .32s ease-in both; }
        .rt-ad-cta { position: relative; overflow: hidden; isolation: isolate; }
        .rt-ad-cta::after {
          content: ""; position: absolute; top: 0; left: -70%; z-index: 1;
          width: 45%; height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent);
          transform: skewX(-18deg);
          animation: rt-ad-shine 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        .rt-ad-float { animation: rt-ad-float 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rt-ad-enter, .rt-ad-exit { animation-duration: .01ms; }
          .rt-ad-cta::after, .rt-ad-float { animation: none; }
        }
      `}</style>

      {/* Non-blocking container: pointer events reach the page everywhere
          except on the card itself — this ad can never swallow page taps. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3 pb-3 sm:justify-end sm:px-0 sm:pb-0">
        <div
          role="dialog"
          aria-label={`REHAN TECH — ${ad.service}`}
          className={`pointer-events-auto w-full max-w-[420px] sm:mr-5 sm:w-[380px] ${
            // Desktop: sit above the floating WhatsApp button.
            "sm:mb-24"
          } ${leaving ? "rt-ad-exit" : "rt-ad-enter"}`}
        >
          <div className="relative overflow-hidden rounded-[20px] bg-white shadow-2xl ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10">
            <button
              type="button"
              onClick={() => dismiss(true)}
              aria-label="Close ad"
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 active:bg-black/85"
            >
              <X size={22} strokeWidth={2.5} />
            </button>

            <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-2.5 pr-14">
              <p className="font-display text-[13px] font-bold tracking-[0.22em] text-white">
                REHAN TECH
              </p>
              <p className="text-[11px] font-medium text-white/85">
                Website Developer | Designer | Automation Expert
              </p>
            </div>

            <div className="p-4 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
                  {ad.service}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  Sponsored
                </span>
              </div>

              <div className="flex items-start gap-3">
                <span className="rt-ad-float flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/25">
                  <Icon size={24} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[16px] font-bold leading-snug tracking-tight text-zinc-900 dark:text-white">
                    {ad.headline}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">
                    {ad.pitch}
                  </p>
                </div>
              </div>

              <a
                href={waLink}
                target="_blank"
                rel="noopener"
                onClick={() => dismiss(true)}
                className="rt-ad-cta mt-3.5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 font-display text-[15px] font-bold text-white shadow-lg shadow-green-500/25 transition active:scale-[0.98]"
              >
                <WhatsAppIcon size={22} className="relative z-[2] shrink-0" />
                <span className="relative z-[2]">{ad.cta}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
