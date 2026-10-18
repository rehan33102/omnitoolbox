"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "otb-intro-seen-v2";
/**
 * Full intro timeline (~5.5s of choreography, out by ~6.0s):
 * 0.0–1.2s  glow breathes in, logo scales in, gradient ring draws/rotates
 * 1.2–2.4s  shine sweep across logo, sparkles rise, glow pulses
 * 2.4–4.2s  name reveals letter-by-letter (blur→sharp, masked slide-up),
 *            finishes with a gradient shimmer pass across the word
 * 4.2–5.5s  gentle settle float, then fade + slight scale out
 * Tap/click anywhere (or any key) skips instantly.
 */
const INTRO_MS = 5500;
const LEAVE_AT_MS = 5500;
const DONE_AT_MS = 6000;
const REDUCED_MS = 700;
const REDUCED_LEAVE_AT_MS = 250;

const NAME_START_MS = 2400;
const LETTER_STAGGER_MS = 45;

/**
 * Premium "viral" brand intro — full-screen overlay that plays once per
 * session on first load: ONLY the logo + the brand name, on dark #050A14.
 * Nothing else — no tagline, no buttons. Content loads underneath the whole
 * time. Tap/click anywhere or any key skips it instantly.
 * Respects prefers-reduced-motion (static logo + name, near-instant).
 */
export default function BrandIntro() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [reduced, setReduced] = useState(false);
  const timers = useRef<number[]>([]);

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
    const doneAt = isReduced ? REDUCED_MS : DONE_AT_MS;

    const finish = () => {
      setLeaving(true);
      const t = window.setTimeout(() => {
        setVisible(false);
        try {
          sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          /* ignore */
        }
      }, 300);
      timers.current.push(t);
    };

    const t1 = window.setTimeout(() => setLeaving(true), leaveAt);
    const t2 = window.setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }, doneAt);
    timers.current.push(t1, t2);

    const skip = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      finish();
    };
    const onKey = () => skip();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const letters = "OmniToolBox".split("");
  const sparks = [0, 1, 2, 3, 4, 5];

  return (
    <div
      aria-hidden
      role="presentation"
      className={`otb-intro${leaving ? " otb-intro--leaving" : ""}${reduced ? " otb-intro--reduced" : ""}`}
      onPointerDown={() => {
        timers.current.forEach((t) => window.clearTimeout(t));
        timers.current = [];
        setLeaving(true);
        const t = window.setTimeout(() => {
          setVisible(false);
          try {
            sessionStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
        }, 280);
        timers.current.push(t);
      }}
    >
      <style>{`
        .otb-intro {
          position: fixed; inset: 0; z-index: 9999;
          display: grid; place-items: center;
          background: #050A14;
          cursor: pointer;
          transition: opacity .5s ease, transform .5s ease;
          overflow: hidden;
        }
        .otb-intro--leaving { opacity: 0; transform: scale(1.04); }

        /* --- breathing radial glow behind everything --- */
        .otb-intro-glow {
          position: absolute; top: 50%; left: 50%;
          width: 82vmin; height: 82vmin;
          background: radial-gradient(circle,
            rgba(168,85,247,.20) 0%,
            rgba(34,211,238,.07) 42%,
            transparent 70%);
          animation: otb-glow-breathe 2.6s ease-in-out infinite alternate;
        }
        @keyframes otb-glow-breathe {
          from { opacity: .5;  transform: translate(-50%,-50%) scale(.92); }
          to   { opacity: 1;   transform: translate(-50%,-50%) scale(1.07); }
        }

        .otb-intro-inner {
          position: relative;
          display: flex; flex-direction: column; align-items: center; gap: 26px;
          padding: 0 24px;
          animation: otb-settle-float 1.3s ease-in-out 4.2s 1;
        }
        @keyframes otb-settle-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }

        /* --- logo stage --- */
        .otb-intro-stage { position: relative; width: 136px; height: 136px; }

        .otb-intro-ring-faint {
          position: absolute; inset: -16px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.09);
          opacity: 0;
          animation: otb-faint-in .9s ease .35s forwards;
        }
        @keyframes otb-faint-in { to { opacity: 1; } }

        .otb-intro-ring-arc {
          position: absolute; inset: -16px; border-radius: 50%;
          background: conic-gradient(from 0deg,
            rgba(240,171,252,0) 0deg,
            rgba(240,171,252,.95) 50deg,
            rgba(34,211,238,.95) 110deg,
            rgba(34,211,238,0) 170deg,
            rgba(240,171,252,0) 360deg);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
          opacity: 0;
          animation: otb-arc-spin 1.4s linear infinite, otb-arc-life 4.5s linear .1s forwards;
        }
        @keyframes otb-arc-spin { to { transform: rotate(1turn); } }
        @keyframes otb-arc-life {
          0% { opacity: 0; } 6% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; }
        }

        .otb-intro-logo-clip {
          position: relative; width: 136px; height: 136px;
          border-radius: 50%; overflow: hidden;
        }
        .otb-intro-logo {
          width: 136px; height: 136px; display: block; object-fit: contain;
          opacity: 0; transform: scale(.8);
          animation: otb-logo-in 1.2s cubic-bezier(.22,1,.36,1) forwards,
                     otb-logo-pulse 1.3s ease-in-out 2s 1;
        }
        @keyframes otb-logo-in {
          from {
            opacity: 0; transform: scale(.8);
            filter: drop-shadow(0 0 0 rgba(168,85,247,0));
          }
          to {
            opacity: 1; transform: scale(1);
            filter: drop-shadow(0 10px 44px rgba(168,85,247,.5));
          }
        }
        @keyframes otb-logo-pulse {
          50% {
            transform: scale(1.035);
            filter: drop-shadow(0 10px 64px rgba(240,171,252,.8));
          }
        }

        .otb-intro-shine {
          position: absolute; top: -40%; left: -70%;
          width: 45%; height: 180%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.7), transparent);
          transform: skewX(-18deg);
          animation: otb-shine-sweep 1.15s ease-in-out 1.3s forwards;
        }
        @keyframes otb-shine-sweep { to { left: 140%; } }

        .otb-intro-spark {
          position: absolute; bottom: 8px;
          width: 5px; height: 5px; border-radius: 50%;
          background: #f0abfc; opacity: 0;
          animation: otb-spark-rise 1.15s ease-out forwards;
        }
        .otb-intro-spark:nth-of-type(2n) { background: #22d3ee; }
        @keyframes otb-spark-rise {
          0%   { opacity: 0; transform: translateY(0) scale(.4); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-96px) scale(1); }
        }

        /* --- name reveal --- */
        .otb-intro-name {
          position: relative;
          overflow: hidden;
          display: flex; justify-content: center;
          font-family: var(--font-display), system-ui, sans-serif;
          font-weight: 800;
          font-size: clamp(32px, 8.5vw, 46px);
          letter-spacing: -0.02em; line-height: 1.2;
          padding: .05em .1em .18em;
          user-select: none;
        }
        .otb-intro-letter {
          display: inline-block;
          opacity: 0; transform: translateY(110%);
          filter: blur(10px);
          animation: otb-letter-in .55s cubic-bezier(.22,1,.36,1) forwards;
        }
        @keyframes otb-letter-in {
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        .otb-intro-shimmer {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(100deg,
            transparent 25%, rgba(255,255,255,.5) 50%, transparent 75%);
          background-size: 220% 100%;
          opacity: 0;
          animation: otb-shimmer-pass 1.05s ease-in-out 3.65s forwards;
        }
        @keyframes otb-shimmer-pass {
          0%   { opacity: 0;  background-position: 200% 0; }
          20%  { opacity: .85; }
          80%  { opacity: .85; }
          100% { opacity: 0;  background-position: -200% 0; }
        }

        /* --- reduced motion: static logo + name, near-instant --- */
        .otb-intro--reduced * { animation: none !important; }
        .otb-intro--reduced .otb-intro-logo {
          opacity: 1; transform: none;
          filter: drop-shadow(0 10px 44px rgba(168,85,247,.5));
        }
        .otb-intro--reduced .otb-intro-letter {
          opacity: 1; transform: none; filter: none;
        }
      `}</style>

      <div className="otb-intro-glow" />
      <div className="otb-intro-inner">
        <div className="otb-intro-stage">
          <div className="otb-intro-ring-faint" />
          <div className="otb-intro-ring-arc" />
          <div className="otb-intro-logo-clip">
            <img
              src="/images/logo-transparent.png"
              alt=""
              width={136}
              height={136}
              className="otb-intro-logo"
              draggable={false}
            />
            <div className="otb-intro-shine" />
          </div>
          {sparks.map((s) => (
            <span
              key={s}
              className="otb-intro-spark"
              style={{
                left: `${20 + s * 11}%`,
                animationDelay: reduced ? "0ms" : `${1300 + s * 120}ms`,
              }}
            />
          ))}
        </div>
        <div className="otb-intro-name">
          {letters.map((ch, i) => (
            <span
              key={i}
              className="otb-intro-letter text-gradient-warm"
              style={{
                animationDelay: reduced
                  ? "0ms"
                  : `${NAME_START_MS + i * LETTER_STAGGER_MS}ms`,
              }}
            >
              {ch}
            </span>
          ))}
          <div className="otb-intro-shimmer" />
        </div>
      </div>
    </div>
  );
}
