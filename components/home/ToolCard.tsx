"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ToolIcon from "@/components/ui/ToolIcon";
import { useTrackToolUsage } from "@/hooks/useTrackToolUsage";
import { cn } from "@/lib/utils";
import type { Tool, ToolCategory } from "@/types";

/**
 * CATEGORY_STYLE — the single source of truth for category colors.
 * ai=violet, image=cyan, social=pink, web=amber, text=lime, pdf=rose.
 */
export const CATEGORY_STYLE: Record<
  ToolCategory,
  {
    label: string;
    /** visual-band gradient (top of card) */
    band: string;
    /** soft dot texture color on the band */
    dots: string;
    /** icon tile + icon color */
    tile: string;
    icon: string;
    /** category chip in the footer */
    chip: string;
    chipDot: string;
  }
> = {
  ai: {
    label: "AI",
    band: "from-violet-600/45 via-violet-800/25 to-transparent",
    dots: "rgba(167,139,250,0.5)",
    tile: "bg-violet-500/20 border-violet-400/30 shadow-[0_0_24px_rgba(139,92,246,0.35)]",
    icon: "text-violet-200",
    chip: "text-violet-300 border-violet-500/30 bg-violet-500/10",
    chipDot: "bg-violet-400",
  },
  image: {
    label: "Image",
    band: "from-cyan-600/45 via-cyan-800/25 to-transparent",
    dots: "rgba(103,232,249,0.5)",
    tile: "bg-cyan-500/20 border-cyan-400/30 shadow-[0_0_24px_rgba(34,211,238,0.35)]",
    icon: "text-cyan-200",
    chip: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
    chipDot: "bg-cyan-400",
  },
  social: {
    label: "Social",
    band: "from-pink-600/45 via-pink-800/25 to-transparent",
    dots: "rgba(249,168,212,0.5)",
    tile: "bg-pink-500/20 border-pink-400/30 shadow-[0_0_24px_rgba(236,72,153,0.35)]",
    icon: "text-pink-200",
    chip: "text-pink-300 border-pink-500/30 bg-pink-500/10",
    chipDot: "bg-pink-400",
  },
  web: {
    label: "Web",
    band: "from-amber-600/45 via-amber-800/25 to-transparent",
    dots: "rgba(252,211,77,0.5)",
    tile: "bg-amber-500/20 border-amber-400/30 shadow-[0_0_24px_rgba(245,158,11,0.35)]",
    icon: "text-amber-200",
    chip: "text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10",
    chipDot: "bg-amber-400",
  },
  text: {
    label: "Text",
    band: "from-lime-600/45 via-lime-800/25 to-transparent",
    dots: "rgba(190,242,100,0.5)",
    tile: "bg-lime-500/20 border-lime-400/30 shadow-[0_0_24px_rgba(132,204,22,0.35)]",
    icon: "text-lime-200",
    chip: "text-lime-300 border-lime-500/30 bg-lime-500/10",
    chipDot: "bg-lime-400",
  },
  pdf: {
    label: "PDF",
    band: "from-rose-600/45 via-rose-800/25 to-transparent",
    dots: "rgba(253,164,175,0.5)",
    tile: "bg-rose-500/20 border-rose-400/30 shadow-[0_0_24px_rgba(244,63,94,0.35)]",
    icon: "text-rose-200",
    chip: "text-rose-300 border-rose-500/30 bg-rose-500/10",
    chipDot: "bg-rose-400",
  },
};

/**
 * ToolCard v2 — taller editorial card with a category-colored visual band
 * header, oversized glowing icon, then title/tagline, and a footer row with
 * category chip + badge + arrow. CSS-only hover lift.
 */
export default function ToolCard({ tool }: { tool: Tool }) {
  const { track } = useTrackToolUsage();
  const s = CATEGORY_STYLE[tool.category];
  // Stagger ambient animations so cards don't pulse in sync (derived from sort order)
  const animDelay = `${((tool.sortOrder ?? 0) % 6) * 1.1}s`;

  return (
    <Link href={tool.href} onClick={() => track(tool.slug, "use")} className="block h-full">
      <Card
        className={cn(
          "h-full !p-0 group overflow-hidden relative flex flex-col tool-card-hover",
          "transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
        )}
      >
        {/* Visual band header — AI image when set, else the category gradient + icon tile */}
        <div className="relative h-32 shrink-0 bg-zinc-900" aria-hidden>
          {tool.image ? (
            <>
              <Image
                // ?v=2 cache-busts old tool card images stuck in browser/CDN cache
                src={`${tool.image}?v=2`}
                alt={`${tool.title} — free online tool`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover tool-img-drift transition-transform duration-500 group-hover:scale-[1.06]"
                style={{ ["--anim-delay" as string]: animDelay }}
              />
              {/* soft ambient glow pulse over the image */}
              <div className="absolute inset-0 tool-glow" style={{ ["--anim-delay" as string]: animDelay }} />
              {/* contrast wash so the icon tile + badge stay legible */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/25" />
            </>
          ) : (
            <>
              <div className={cn("absolute inset-0 bg-gradient-to-br", s.band)} />
              {/* dot texture */}
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage: `radial-gradient(${s.dots} 1px, transparent 1.5px)`,
                  backgroundSize: "18px 18px",
                  maskImage: "linear-gradient(to bottom, black 30%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 30%, transparent 100%)",
                }}
              />
            </>
          )}
          {/* big glowing icon, centered — floats above the image too */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "grid size-16 place-items-center rounded-2xl border backdrop-blur-sm tool-img-breathe",
                "transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
                s.tile
              )}
              style={{ ["--anim-delay" as string]: animDelay }}
            >
              <ToolIcon name={tool.icon} size={30} className={s.icon} />
            </span>
          </div>
          {/* badge top-right */}
          {tool.badge && (
            <div className="absolute top-3 right-3">
              <Badge variant={tool.badge === "new" ? "new" : "ai"}>{tool.badge}</Badge>
            </div>
          )}
          {/* open arrow top-left, appears on hover */}
          <span className="absolute top-3 left-3 grid size-8 place-items-center rounded-full bg-black/30 border border-black/10 dark:border-white/10 text-white/70 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <ArrowUpRight size={15} />
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col p-5 pt-4">
          <h3 className="font-display text-lg font-bold tracking-tight leading-snug group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            {tool.title}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed mt-1.5">{tool.tagline}</p>

          {/* Footer row */}
          <div className="mt-auto pt-4 flex items-center justify-between">
            <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider border rounded-full px-2.5 py-1", s.chip)}>
              <span className={cn("size-1.5 rounded-full", s.chipDot)} />
              {s.label}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:gap-2 transition-all">
              Open <ArrowRight size={14} />
            </span>
          </div>
        </div>

        {/* bottom accent line that lights up on hover */}
        <div className={cn("h-0.5 w-full bg-gradient-to-r opacity-40 group-hover:opacity-100 transition-opacity", s.band)} aria-hidden />
      </Card>
    </Link>
  );
}
