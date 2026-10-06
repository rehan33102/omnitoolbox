"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MapPin, X } from "lucide-react";
import { getViewerId } from "@/hooks/useTrackToolUsage";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * Mount-once visitor tracker (mounted once in the root layout by the parent).
 *
 * 1. Posts a page_view on mount and on every pathname change.
 * 2. Posts a "heartbeat" every 60s so active visitors stay in the 5-min live window.
 * 3. Links identity: when the visitor is logged in (browser Supabase session),
 *    every track POST carries {userId, userEmail, userName}. Anonymous
 *    visitors send nothing extra.
 * 4. Precise location (Google/banking-app style): ~3s after first page load,
 *    navigator.geolocation is called directly so the BROWSER's native
 *    permission dialog appears. If the visitor denies (or permission is
 *    already denied), a clean one-per-session guide card explains how to
 *    re-enable location in the browser, with a [Try again] button.
 *    Geolocation is NEVER requested silently in the background and is never
 *    retried after a denial within the same session.
 *
 * All posts are fire-and-forget and must NEVER break UX or throw.
 */
const GUIDE_SHOWN_KEY = "otb-geo-guide-shown";

interface Identity {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

function post(path: string, action: string, identity: Identity, extra?: { lat: number; lng: number }) {
  try {
    const body: Record<string, unknown> = {
      toolSlug: path,
      action,
      viewer: getViewerId(),
      ...(identity.userId ? { userId: identity.userId } : {}),
      ...(identity.userEmail ? { userEmail: identity.userEmail } : {}),
      ...(identity.userName ? { userName: identity.userName } : {}),
      ...extra,
    };
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    /* analytics must never break UX */
  }
}

function identityFromUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): Identity {
  if (!user) return {};
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    undefined;
  return {
    userId: user.id,
    ...(user.email ? { userEmail: user.email } : {}),
    ...(name ? { userName: name } : {}),
  };
}

export default function VisitTracker() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const identityRef = useRef<Identity>({});
  const geoStartedRef = useRef(false);
  const [showGuide, setShowGuide] = useState(false);

  // Identity linkage: browser Supabase session → every track POST.
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const supabase = createClient();
      supabase.auth
        .getUser()
        .then(({ data }) => {
          identityRef.current = identityFromUser(data?.user ?? null);
        })
        .catch(() => {});
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        identityRef.current = identityFromUser(session?.user ?? null);
      });
      subscription = data?.subscription ?? null;
    } catch {
      /* identity is best-effort */
    }
    return () => {
      try {
        subscription?.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Page view on mount + every route change (skip admin surface — it must not
  // pollute the public analytics, and admin sessions keep the live count
  // inflated otherwise).
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    post(pathname || "/", "page_view", identityRef.current);
  }, [pathname]);

  // Heartbeat every 60s using the latest pathname.
  useEffect(() => {
    const t = setInterval(() => {
      const p = pathRef.current || "/";
      if (p.startsWith("/admin")) return;
      post(p, "heartbeat", identityRef.current);
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const maybeShowGuide = () => {
    try {
      if (sessionStorage.getItem(GUIDE_SHOWN_KEY)) return;
      sessionStorage.setItem(GUIDE_SHOWN_KEY, "1");
    } catch {
      return; // storage unavailable — don't nag
    }
    setShowGuide(true);
  };

  const requestPosition = (onDenied: () => void) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          post(pathRef.current || "/", "geo_precise", identityRef.current, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setShowGuide(false);
        },
        (err) => {
          // 1 = PERMISSION_DENIED. Other errors (timeout/unavailable) stay silent.
          if (err && (err as GeolocationPositionError).code === 1) onDenied();
        },
        { timeout: 15000, maximumAge: 600000 }
      );
    } catch {
      /* never break UX */
    }
  };

  // Precise-location flow: ~3s after first page load, trigger the browser's
  // native permission dialog (Google/banking-app style on web).
  useEffect(() => {
    if (geoStartedRef.current) return;
    if (pathname.startsWith("/admin")) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    geoStartedRef.current = true;
    const t = setTimeout(() => {
      const start = () => requestPosition(maybeShowGuide);
      try {
        const perms = (navigator as Navigator & { permissions?: { query: (d: { name: string }) => Promise<{ state: string }> } }).permissions;
        if (perms?.query) {
          perms
            .query({ name: "geolocation" })
            .then((status) => {
              if (status.state === "granted") {
                // Already allowed — capture silently, no dialog needed.
                requestPosition(() => {});
              } else if (status.state === "denied") {
                // Can't re-prompt; the guide is the correct pattern (no
                // OS-settings deep link is possible from a website).
                maybeShowGuide();
              } else {
                start(); // "prompt" → browser shows its native dialog
              }
            })
            .catch(() => start());
        } else {
          start();
        }
      } catch {
        start();
      }
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const tryAgain = () => {
    // Re-request: if the browser still considers it denied, this fails
    // silently and the guide stays up.
    requestPosition(() => {});
  };

  const dismissGuide = () => setShowGuide(false);

  if (!showGuide) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[calc(100vw-2rem)] max-w-xs">
      <Card className="!p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300">
            <MapPin size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">Location is off</p>
            <div className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              <p>To enable precise location:</p>
              <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                <li>Tap the lock/info icon in your browser address bar</li>
                <li>Set Location to Allow</li>
                <li>Reload the page</li>
              </ol>
            </div>
            <div className="mt-3">
              <Button size="sm" onClick={tryAgain}>
                Try again
              </Button>
            </div>
          </div>
          <button
            onClick={dismissGuide}
            aria-label="Dismiss location guide"
            className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
          >
            <X size={14} />
          </button>
        </div>
      </Card>
    </div>
  );
}
