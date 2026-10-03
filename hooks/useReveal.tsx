"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useReveal — lightweight scroll-reveal via IntersectionObserver.
 * GPU-friendly: only toggles a class; the .reveal CSS handles transform/opacity.
 *
 * Usage:
 *   const { ref, visible } = useReveal<HTMLDivElement>();
 *   <div ref={ref} className={cn("reveal", visible && "is-visible")}>…</div>
 *
 * For staggered grids, pass `delay` (ms) — applied as transition-delay.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    // If IO is unavailable, show immediately.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, threshold]);

  return { ref, visible };
}

/**
 * Reveal — drop-in wrapper. Renders a div (or custom tag) that reveals on scroll.
 */
import { createElement, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  delay?: number;
  variant?: "up" | "scale";
  threshold?: number;
};

export function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  variant = "up",
  threshold = 0.15,
}: RevealProps) {
  const { ref, visible } = useReveal<HTMLElement>(threshold);
  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;
  return createElement(
    as,
    {
      ref,
      style,
      className: cn(variant === "scale" ? "reveal-scale" : "reveal", visible && "is-visible", className),
    },
    children
  );
}
