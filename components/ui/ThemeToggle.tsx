"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated day/night theme toggle — a pill switch with a springy sliding knob.
 * Sun (day) slides left on a sky gradient with a drifting cloud;
 * Moon (night) slides right on a deep-space gradient with twinkling stars.
 * Icons rotate + cross-fade inside the knob. Pure CSS, no extra deps.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn("h-9 w-[68px] rounded-full glass", className)} aria-hidden />;
  }

  const isDark = (resolvedTheme ?? theme) === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "group relative h-9 w-[68px] shrink-0 overflow-hidden rounded-full",
        "transition-colors duration-500",
        "ring-1 ring-black/10 dark:ring-white/15",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70",
        isDark
          ? "bg-gradient-to-r from-indigo-950 via-[#1c1c40] to-[#2c1a4e] shadow-[inset_0_2px_10px_rgba(0,0,0,0.55)]"
          : "bg-gradient-to-r from-sky-300 via-sky-200 to-amber-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {/* twinkling stars — night */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          isDark ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="absolute left-3 top-2 h-1 w-1 rounded-full bg-white animate-twinkle" />
        <span className="absolute left-6 top-[22px] h-[3px] w-[3px] rounded-full bg-white/80 animate-twinkle [animation-delay:0.7s]" />
        <span className="absolute left-10 top-2.5 h-[2px] w-[2px] rounded-full bg-white/60 animate-twinkle [animation-delay:1.4s]" />
        <span className="absolute left-8 top-1 h-[2px] w-[2px] rounded-full bg-white/70 animate-twinkle [animation-delay:2.1s]" />
      </span>

      {/* drifting cloud — day */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-all duration-700",
          isDark ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100"
        )}
      >
        <span className="absolute left-2 top-2.5 h-3 w-3 rounded-full bg-white/95 blur-[1px]" />
        <span className="absolute left-[15px] top-1.5 h-4 w-4 rounded-full bg-white/85 blur-[1px]" />
        <span className="absolute left-7 top-3 h-2.5 w-2.5 rounded-full bg-white/95 blur-[1px]" />
      </span>

      {/* sliding knob with morphing sun/moon */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1 grid h-7 w-7 place-items-center rounded-full",
          "transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.4,0.64,1)]",
          isDark
            ? "left-[36px] bg-gradient-to-br from-zinc-100 to-zinc-300 shadow-[0_2px_12px_rgba(255,255,255,0.4)]"
            : "left-1 bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_2px_12px_rgba(251,146,60,0.6)]"
        )}
      >
        <Sun
          size={15}
          className={cn(
            "absolute text-amber-950 transition-all duration-500",
            isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          )}
        />
        <Moon
          size={15}
          className={cn(
            "absolute text-indigo-950 transition-all duration-500",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          )}
        />
      </span>
    </button>
  );
}
