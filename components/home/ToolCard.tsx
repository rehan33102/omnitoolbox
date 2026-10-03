"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ToolIcon from "@/components/ui/ToolIcon";
import { useTrackToolUsage } from "@/hooks/useTrackToolUsage";
import { cn } from "@/lib/utils";
import type { Tool } from "@/types";

export default function ToolCard({ tool }: { tool: Tool }) {
  const { track } = useTrackToolUsage();

  return (
    <Link href={tool.href} onClick={() => track(tool.slug, "use")} className="block h-full">
      <Card
        className={cn(
          "h-full group glow-card overflow-hidden relative",
          "transition-all duration-300"
        )}
      >
        {/* warm top-glow accent on hover */}
        <div
          aria-hidden
          className="absolute -top-16 left-1/2 -translate-x-1/2 h-32 w-48 rounded-full bg-ember-500/0 blur-[40px] transition-all duration-500 group-hover:bg-ember-500/25 pointer-events-none"
        />
        <div className="flex items-start justify-between mb-4 relative">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-ember-500/25 via-magent-500/15 to-brand-600/25 border border-white/10 transition-shadow duration-500 group-hover:shadow-glow-warm">
            <ToolIcon name={tool.icon} className="text-ember-300 group-hover:text-ember-200 transition-colors" />
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-zinc-600 group-hover:text-ember-300 group-hover:border-ember-500/40 group-hover:rotate-45 transition-all duration-300">
            <ArrowUpRight size={15} />
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="font-display font-semibold tracking-tight group-hover:text-white transition-colors">
            {tool.title}
          </h3>
          {tool.badge && <Badge variant={tool.badge === "new" ? "new" : "ai"}>{tool.badge}</Badge>}
        </div>
        <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed">{tool.tagline}</p>
      </Card>
    </Link>
  );
}
