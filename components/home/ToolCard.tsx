"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ToolIcon from "@/components/ui/ToolIcon";
import { useTrackToolUsage } from "@/hooks/useTrackToolUsage";
import type { Tool } from "@/types";

export default function ToolCard({ tool }: { tool: Tool }) {
  const { track } = useTrackToolUsage();

  return (
    <Link href={tool.href} onClick={() => track(tool.slug, "use")}>
      <Card hover className="h-full group">
        <div className="flex items-start justify-between mb-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-600/30 to-accent-500/20 border border-white/10">
            <ToolIcon name={tool.icon} className="text-brand-300" />
          </span>
          <ArrowUpRight size={17} className="text-zinc-600 group-hover:text-brand-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="font-display font-semibold">{tool.title}</h3>
          {tool.badge && <Badge variant={tool.badge === "new" ? "new" : "ai"}>{tool.badge}</Badge>}
        </div>
        <p className="text-sm text-zinc-400 line-clamp-2">{tool.tagline}</p>
      </Card>
    </Link>
  );
}
