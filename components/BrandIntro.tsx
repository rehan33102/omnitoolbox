"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "otb-intro-seen-v3";
/**
 * Origami intro timeline (~5.7s of choreography, out by ~5.8s):
 * 0.15–1.3s  origami fox mark builds facet-by-facet (spring easing)
 * 0.9s       halo glows in behind the mark
 * 1.5–1.6s   wordmark slides up masked: "Omni" white + "ToolBox" gradient
 * 2.35s      gradient rule grows
 * 2.8s       tagline "Every tool. One place." fades up
 * 3.15s      light sweep passes across
 * 4.7–5.7s   veil settles to dark, overlay fades out
 * Tap/click anywhere (or any key) skips instantly.
 */
const LEAVE_AT_MS = 5200;
const DONE_AT_MS = 5750;
const REDUCED_MS = 700;
const REDUCED_LEAVE_AT_MS = 250;

/**
 * Origami brand intro — full-screen overlay that plays once per session
 * on first load: the origami fox mark building facet-by-facet, then the
 * "OmniToolBox" wordmark and tagline, on dark #050A14.
 * Content loads underneath the whole time. Tap/click anywhere or any key
 * skips it instantly. Respects prefers-reduced-motion (static mark +
 * name, near-instant).
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

  const facet = (delay: string) => ({
    animationDelay: reduced ? "0ms" : delay,
  });

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
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: #050A14;
          cursor: pointer;
          transition: opacity .5s ease, transform .5s ease;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }
        .otb-intro--leaving { opacity: 0; transform: scale(1.04); }

        /* --- halo glow behind the mark --- */
        .otb-origami-halo {
          position: absolute; width: 340px; height: 340px; border-radius: 50%;
          background: radial-gradient(circle, rgba(168,85,247,.30), rgba(59,130,246,.12) 55%, transparent 70%);
          filter: blur(10px); opacity: 0; transform: scale(.7);
          animation: otb-halo-in 1.4s ease .9s forwards;
        }
        @keyframes otb-halo-in { to { opacity: 1; transform: scale(1); } }

        /* --- origami fox mark --- */
        .otb-origami-foxwrap { position: relative; width: 150px; height: 150px; margin-bottom: 26px; }
        .otb-origami-fox { width: 100%; height: 100%; overflow: visible; }
        .otb-origami-facet {
          opacity: 0; transform-origin: 60px 62px;
          animation: otb-facet-in .65s cubic-bezier(.34,1.4,.64,1) forwards;
        }
        @keyframes otb-facet-in {
          from { opacity: 0; transform: scale(.4) rotate(-8deg); }
          to { opacity: 1; transform: scale(1) rotate(0); }
        }
        .otb-origami-shadow {
          position: absolute; left: 50%; bottom: -16px; width: 110px; height: 16px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse, rgba(0,0,0,.55), transparent 70%);
          opacity: 0; animation: otb-fade-in 1s ease 1.3s forwards;
        }
        @keyframes otb-fade-in { to { opacity: 1; } }

        /* --- wordmark: masked slide-up --- */
        .otb-origami-word {
          display: flex; align-items: baseline;
          font-family: var(--font-display), system-ui, sans-serif;
          font-size: clamp(36px, 9.6vw, 60px); font-weight: 700; letter-spacing: -.01em;
          user-select: none;
        }
        .otb-origami-mask { overflow: hidden; display: inline-flex; }
        .otb-origami-mask > span {
          display: inline-block; transform: translateY(112%);
          animation: otb-rise .8s cubic-bezier(.22,1,.36,1) forwards;
        }
        @keyframes otb-rise { to { transform: translateY(0); } }
        .otb-origami-w1 { color: #fff; }
        .otb-origami-w2 {
          background: linear-gradient(92deg, #38bdf8, #818cf8 55%, #e879f9);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }

        /* --- rule + tagline --- */
        .otb-origami-rule {
          width: 0; height: 2px; margin-top: 22px; border-radius: 99px;
          background: linear-gradient(90deg, transparent, #38bdf8, #e879f9, transparent);
          animation: otb-rule-grow .9s cubic-bezier(.65,0,.25,1) 2.35s forwards;
        }
        @keyframes otb-rule-grow { to { width: min(260px, 62vw); } }
        .otb-origami-tag {
          margin-top: 16px;
          font-family: "Manrope", var(--font-display), system-ui, sans-serif;
          font-weight: 600; font-size: 11.5px; letter-spacing: .5em; text-transform: uppercase;
          color: rgba(255,255,255,.55); text-indent: .5em;
          opacity: 0; animation: otb-tag-in .9s ease 2.8s forwards;
        }
        @keyframes otb-tag-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* --- light sweep + settling veil --- */
        .otb-origami-sweep { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .otb-origami-sweep::after {
          content: ''; position: absolute; top: -20%; bottom: -20%; width: 34%; left: -45%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.09), transparent);
          transform: skewX(-14deg); animation: otb-sweep-move 1.3s ease 3.15s forwards;
        }
        @keyframes otb-sweep-move { to { left: 130%; } }
        .otb-origami-veil {
          position: absolute; inset: 0; background: #050A14; opacity: 0; pointer-events: none;
          animation: otb-veil 1s ease 4.7s forwards;
        }
        @keyframes otb-veil { to { opacity: 1; } }

        /* --- reduced motion: static mark + name, near-instant --- */
        .otb-intro--reduced * { animation: none !important; }
        .otb-intro--reduced .otb-origami-facet { opacity: 1; transform: none; }
        .otb-intro--reduced .otb-origami-mask > span { transform: none; }
        .otb-intro--reduced .otb-origami-rule { width: min(260px, 62vw); }
        .otb-intro--reduced .otb-origami-tag { opacity: 1; transform: none; }
        .otb-intro--reduced .otb-origami-halo { opacity: 1; transform: none; }
        .otb-intro--reduced .otb-origami-shadow { opacity: 1; }
        .otb-intro--reduced .otb-origami-veil { opacity: 0; }
      `}</style>

      <div className="otb-origami-halo" />
      <div className="otb-origami-foxwrap">
        <svg className="otb-origami-fox" viewBox="0 0 120 120" aria-hidden>
          {/* ears */}
          <polygon className="otb-origami-facet" style={facet(".15s")} points="18,14 44,34 22,44" fill="#f472b6" />
          <polygon className="otb-origami-facet" style={facet(".25s")} points="102,14 76,34 98,44" fill="#e879f9" />
          {/* head facets */}
          <polygon className="otb-origami-facet" style={facet(".38s")} points="22,44 60,30 44,62" fill="#a78bfa" />
          <polygon className="otb-origami-facet" style={facet(".48s")} points="98,44 60,30 76,62" fill="#818cf8" />
          <polygon className="otb-origami-facet" style={facet(".58s")} points="44,62 60,30 76,62 60,78" fill="#60a5fa" />
          {/* cheeks / muzzle */}
          <polygon className="otb-origami-facet" style={facet(".70s")} points="22,44 44,62 52,92" fill="#38bdf8" />
          <polygon className="otb-origami-facet" style={facet(".80s")} points="98,44 76,62 68,92" fill="#22d3ee" />
          <polygon className="otb-origami-facet" style={facet(".92s")} points="52,92 60,78 68,92 60,106" fill="#f0abfc" />
          {/* eyes */}
          <circle className="otb-origami-facet" style={facet("1.15s")} cx="45" cy="58" r="3.2" fill="#050A14" />
          <circle className="otb-origami-facet" style={facet("1.22s")} cx="75" cy="58" r="3.2" fill="#050A14" />
          {/* nose */}
          <polygon className="otb-origami-facet" style={facet("1.3s")} points="56,97 64,97 60,103" fill="#050A14" />
        </svg>
        <div className="otb-origami-shadow" />
      </div>
      <div className="otb-origami-word">
        <span className="otb-origami-mask">
          <span className="otb-origami-w1" style={{ animationDelay: reduced ? "0ms" : "1500ms" }}>Omni</span>
        </span>
        <span className="otb-origami-mask">
          <span className="otb-origami-w2" style={{ animationDelay: reduced ? "0ms" : "1620ms" }}>ToolBox</span>
        </span>
      </div>
      <div className="otb-origami-rule" />
      <div className="otb-origami-tag">Every tool. One place.</div>
      <div className="otb-origami-sweep" />
      <div className="otb-origami-veil" />
    </div>
  );
}
