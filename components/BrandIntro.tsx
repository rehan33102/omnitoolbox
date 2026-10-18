"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "otb-intro-seen-v1";
/** Full intro timeline (~1.9s): logo 0→0.8s, name 0.5→1.4s, fade-out 1.5→1.9s. */
const INTRO_MS = 1900;
const LEAVE_AT_MS = 1500;
const REDUCED_MS = 700;
const REDUCED_LEAVE_AT_MS = 250;

const LETTER_DELAY_MS = 500;
const LETTER_STAGGER_MS = 40;

/**
 * Premium brand intro — full-screen overlay that plays once per session on
 * first load: the logo animates in first (soft scale + fade + glow), then the
 * brand name reveals letter-by-letter below it. Nothing else — no tagline, no
 * buttons. Fades out into the page; content loads underneath the whole time.
 *
 * pointer-events: none so a stuck overlay can never block taps.
 * Respects prefers-reduced-motion (static logo + name, near-instant).
 * Session note: plays once per tab session; OS-level PWA splash (manifest
 * name/description) is handled separately in app/manifest.ts.
 */
export default function BrandIntro() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — play the intro once */
    }
    if (seen) return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const isReduced = !!mq?.matches;
    setReduced(isReduced);
    setVisible(true);
    const leaveAt = isReduced ? REDUCED_LEAVE_AT_MS : LEAVE_AT_MS;
    const doneAt = isReduced ? REDUCED_MS : INTRO_MS;
    const t1 = window.setTimeout(() => setLeaving(true), leaveAt);
    const t2 = window.setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }, doneAt);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  const letters = "OmniToolBox".split("");

  return (
    <div
      aria-hidden
      className={`otb-intro${leaving ? " otb-intro--leaving" : ""}${reduced ? " otb-intro--reduced" : ""}`}
    >
      <style>{`
        .otb-intro {
          position: fixed; inset: 0; z-index: 9999;
          display: grid; place-items: center;
          background: #050A14;
          pointer-events: none;
          transition: opacity .45s ease;
        }
        .otb-intro--leaving { opacity: 0; }
        .otb-intro-inner {
          display: flex; flex-direction: column; align-items: center; gap: 20px;
          padding: 0 24px;
        }
        .otb-intro-logo {
          width: 104px; height: 104px; object-fit: contain;
          opacity: 0; transform: scale(.82);
          animation: otb-logo-in .8s cubic-bezier(.22,1,.36,1) .05s forwards;
        }
        @keyframes otb-logo-in {
          from {
            opacity: 0; transform: scale(.82);
            filter: drop-shadow(0 0 0 rgba(168,85,247,0));
          }
          to {
            opacity: 1; transform: scale(1);
            filter: drop-shadow(0 8px 32px rgba(168,85,247,.45));
          }
        }
        .otb-intro-name {
          overflow: hidden; display: flex; justify-content: center;
          font-family: var(--font-display), system-ui, sans-serif;
          font-weight: 800;
          font-size: clamp(30px, 8vw, 44px);
          letter-spacing: -0.02em; line-height: 1.15;
          padding-bottom: .1em;
          user-select: none;
        }
        .otb-intro-letter {
          display: inline-block;
          opacity: 0; transform: translateY(110%);
          animation: otb-letter-in .5s cubic-bezier(.22,1,.36,1) forwards;
        }
        @keyframes otb-letter-in {
          to { opacity: 1; transform: translateY(0); }
        }
        .otb-intro--reduced .otb-intro-logo {
          animation: none; opacity: 1; transform: none;
          filter: drop-shadow(0 8px 32px rgba(168,85,247,.45));
        }
        .otb-intro--reduced .otb-intro-letter {
          animation: none; opacity: 1; transform: none;
        }
      `}</style>
      <div className="otb-intro-inner">
        <img
          src="/images/logo.png"
          alt=""
          width={104}
          height={104}
          className="otb-intro-logo"
          draggable={false}
        />
        <div className="otb-intro-name">
          {letters.map((ch, i) => (
            <span
              key={i}
              className="otb-intro-letter text-gradient-warm"
              style={{ animationDelay: reduced ? "0ms" : `${LETTER_DELAY_MS + i * LETTER_STAGGER_MS}ms` }}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
