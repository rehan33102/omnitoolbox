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
 *    the permission state is checked:
 *    - "granted" → capture silently in the background, NO popup at all.
 *    - "denied" → show the re-enable guide card (can't re-prompt natively).
 *    - "prompt" → show our own visible pre-prompt card first (DOM-verifiable);
 *                  tapping "Share location" triggers the browser's native dialog.
 *    If the visitor later grants permission (e.g. enables it in the browser
 *    site settings while the page is open), any visible prompt/guide card
 *    auto-dismisses and the location is captured silently — no manual
 *    dismiss needed. This is watched via PermissionStatus.onchange plus
 *    visibilitychange/focus re-checks.
 * 5. The guide card's "Try again" re-checks the permission state first: if
 *    now granted it captures silently, if reset to "prompt" it triggers the
 *    native dialog, and if still denied it shows a clear inline hint instead
 *    of silently doing nothing.
 *
 * All posts are fire-and-forget and must NEVER break UX or throw.
 */
const GUIDE_SHOWN_KEY = "otb-geo-guide-shown";
const PROMPT_SHOWN_KEY = "otb-geo-prompt-shown";

interface GeoPermissionStatus {
  state: string;
  onchange: ((this: unknown, ev: Event) => void) | null;
}

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
  const [showPrompt, setShowPrompt] = useState(false);
  // Shown inside the guide card when "Try again" is tapped while the
  // permission is still denied — so the tap never feels like it did nothing.
  const [guideHint, setGuideHint] = useState(false);

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

  const dismissGeoCards = () => {
    setShowGuide(false);
    setShowPrompt(false);
    setGuideHint(false);
  };

  const requestPosition = (onDenied: () => void) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          post(pathRef.current || "/", "geo_precise", identityRef.current, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          // Success (including silent capture after a grant) always clears cards.
          setShowGuide(false);
          setShowPrompt(false);
          setGuideHint(false);
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

  // Precise-location flow (Google/banking-app style on web):
  // ~3s after first page load, check the permission state:
  // - "granted" → capture silently in the background, NO popup at all.
  // - "denied" → show the re-enable guide card (can't re-prompt natively).
  // - "prompt" → show our own visible pre-prompt card first (DOM-verifiable);
  //               tapping "Share location" triggers the browser's native dialog.
  // If permission later flips to granted (visitor enabled it in the browser
  // site settings and came back), any visible card auto-dismisses and the
  // location is captured silently — watched via PermissionStatus.onchange
  // plus visibilitychange/focus re-checks.
  useEffect(() => {
    if (geoStartedRef.current) return;
    if (pathname.startsWith("/admin")) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    geoStartedRef.current = true;

    const perms = (
      navigator as unknown as {
        permissions?: { query: (d: { name: string }) => Promise<GeoPermissionStatus> };
      }
    ).permissions;

    // Permission just became granted (or is granted on re-check): clear any
    // visible cards and capture silently — never show a popup here.
    const handleGranted = () => {
      dismissGeoCards();
      requestPosition(() => {});
    };

    // Re-check on return-to-page: the visitor may have flipped the permission
    // in the browser site settings while the tab was hidden/backgrounded.
    const recheckPermission = () => {
      try {
        if (!perms?.query) return;
        perms
          .query({ name: "geolocation" })
          .then((s) => {
            if (s && s.state === "granted") handleGranted();
            // Other states: leave cards exactly as they are (no nagging).
          })
          .catch(() => {});
      } catch {
        /* ignore */
      }
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        recheckPermission();
      }
    };

    let permStatus: GeoPermissionStatus | null = null;
    const t = setTimeout(() => {
      const showPrePrompt = () => {
        try {
          if (sessionStorage.getItem(PROMPT_SHOWN_KEY)) return;
          sessionStorage.setItem(PROMPT_SHOWN_KEY, "1");
        } catch {
          return;
        }
        setShowPrompt(true);
      };
      try {
        if (perms?.query) {
          perms
            .query({ name: "geolocation" })
            .then((status) => {
              permStatus = status;
              try {
                // Live-watch for the denied→granted flip.
                status.onchange = () => {
                  if (status.state === "granted") handleGranted();
                };
              } catch {
                /* older browsers without onchange support */
              }
              if (status.state === "granted") {
                // Already allowed — capture silently, no dialog needed.
                requestPosition(() => {});
              } else if (status.state === "denied") {
                // Can't re-prompt; the guide is the correct pattern (no
                // OS-settings deep link is possible from a website).
                maybeShowGuide();
              } else {
                showPrePrompt();
              }
            })
            .catch(() => showPrePrompt());
        } else {
          showPrePrompt();
        }
      } catch {
        showPrePrompt();
      }
    }, 3000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", recheckPermission);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", recheckPermission);
      if (permStatus) {
        try {
          permStatus.onchange = null;
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const acceptPrompt = () => {
    setShowPrompt(false);
    // User tapped "Share location" → trigger the browser's native dialog.
    requestPosition(maybeShowGuide);
  };

  const dismissPrompt = () => setShowPrompt(false);

  // Smart "Try again": re-check the permission state BEFORE requesting, so a
  // tap never silently does nothing.
  const tryAgain = async () => {
    try {
      const perms = (
        navigator as unknown as {
          permissions?: { query: (d: { name: string }) => Promise<GeoPermissionStatus> };
        }
      ).permissions;
      if (perms?.query) {
        const status = await perms.query({ name: "geolocation" });
        if (status.state === "granted") {
          // Permission now granted — hide the guide and capture silently.
          setShowGuide(false);
          setGuideHint(false);
          requestPosition(() => {});
          return;
        }
        if (status.state === "prompt") {
          // Permission was reset (or never decided) — behave like fresh:
          // hide the guide and trigger the browser's native dialog.
          setShowGuide(false);
          setGuideHint(false);
          requestPosition(maybeShowGuide);
          return;
        }
      }
    } catch {
      /* fall through to the still-denied path */
    }
    // Still denied — request anyway (a no-op the browser swallows), but show
    // a clear inline hint so the user knows what to do next.
    setGuideHint(true);
    requestPosition(() => {});
  };

  const dismissGuide = () => {
    setShowGuide(false);
    setGuideHint(false);
  };

  if (!showGuide && !showPrompt) return null;

  return (
    <>
      {showPrompt && (
        <div
          className="fixed bottom-4 right-4 z-[90] w-[calc(100vw-2rem)] max-w-xs"
          data-testid="geo-pre-prompt"
          role="dialog"
          aria-label="Share your location"
        >
          <Card className="!p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300">
                <MapPin size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">Share your location?</p>
                <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                  Allow precise location for a more personalized experience. You can change this anytime in your browser settings.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={acceptPrompt}>
                    Share location
                  </Button>
                  <Button size="sm" variant="secondary" onClick={dismissPrompt}>
                    Not now
                  </Button>
                </div>
              </div>
              <button
                onClick={dismissPrompt}
                aria-label="Dismiss location prompt"
                className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
              >
                <X size={14} />
              </button>
            </div>
          </Card>
        </div>
      )}
      {showGuide && (
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
                {guideHint && (
                  <p className="mt-2.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                    Still blocked — allow Location in your browser&apos;s site settings first, then tap Try again.
                  </p>
                )}
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
      )}
    </>
  );
}
