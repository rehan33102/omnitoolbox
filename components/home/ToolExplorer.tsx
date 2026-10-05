"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchX, Sparkles } from "lucide-react";
import SmartSearch from "./SmartSearch";
import ToolCard from "./ToolCard";
import SectionHeader from "./SectionHeader";
import Badge from "@/components/ui/Badge";
import ToolIcon from "@/components/ui/ToolIcon";
import { Reveal } from "@/hooks/useReveal";
import { TOOL_CATEGORIES, type ToolCategoryId } from "@/lib/constants";
import { findAlternatives, smartSearch } from "@/lib/smart-search";
import { useToolOverrides } from "@/hooks/useToolOverrides";
import { applyToolOverrides } from "@/lib/tool-overrides";
import { cn } from "@/lib/utils";
import type { Tool } from "@/types";

function ExplorerInner({ tools }: { tools: Tool[] }) {
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [cat, setCat] = useState<"all" | ToolCategoryId>("all");

  // Admin edits from /admin/tools (IndexedDB/localStorage) apply instantly.
  const overrides = useToolOverrides();
  const liveTools = useMemo(() => applyToolOverrides(tools, overrides), [tools, overrides]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const base = cat === "all" ? liveTools : liveTools.filter((t) => t.category === cat);
    if (!q) return base;
    const slugs = new Set(smartSearch(liveTools, q, 100).map((h) => h.tool.slug));
    return base.filter((t) => slugs.has(t.slug));
  }, [liveTools, query, cat]);

  const alternatives = useMemo(
    () => (query.trim() && filtered.length === 0 ? findAlternatives(liveTools, query, 3) : []),
    [liveTools, query, filtered.length]
  );

  return (
    <section id="tools" className="container scroll-mt-24">
      <SectionHeader
        eyebrow="The collection"
        title={<>Find your <span className="text-gradient-warm">tool</span></>}
        sub={`Search across all ${liveTools.length} utilities — free forever, no signup.`}
      />

      <Reveal delay={100}>
        <div className="max-w-2xl mx-auto relative mb-6 z-30">
          <SmartSearch
            tools={liveTools}
            variant="hero"
            initialQuery={params.get("q") ?? ""}
            onQueryChange={setQuery}
          />
        </div>
      </Reveal>

      {/* Category pills — always visible, grid filters live below */}
      <Reveal delay={160}>
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setCat("all")}
            className={cn("btn-base px-4 py-2 text-sm rounded-full border",
              cat === "all" ? "bg-gradient-to-r from-ember-500 to-magent-500 text-white border-transparent shadow-glow-warm" : "glass text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
          >
            All <Badge variant="default" className="ml-1">{liveTools.length}</Badge>
          </button>
          {TOOL_CATEGORIES.map((c) => {
            const n = liveTools.filter((t) => t.category === c.id).length;
            if (!n) return null;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={cn("btn-base px-4 py-2 text-sm rounded-full border",
                  cat === c.id ? "bg-gradient-to-r from-ember-500 to-magent-500 text-white border-transparent shadow-glow-warm" : "glass text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
              >
                {c.label} <Badge variant="default" className="ml-1">{n}</Badge>
              </button>
            );
          })}
        </div>
      </Reveal>

      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 cv-auto">
          {filtered.map((t) => <ToolCard key={t.slug} tool={t} />)}
        </div>
      ) : (
        <div className="text-center py-16">
          <SearchX size={36} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-zinc-500">No tools match “{query}”. Try another keyword.</p>
          {alternatives.length > 0 && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                <Sparkles size={12} className="text-ember-600 dark:text-ember-400" />
                Did you mean / alternatives
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {alternatives.map(({ tool }) => (
                  <a
                    key={tool.slug}
                    href={tool.href}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:border-ember-400/50 transition"
                  >
                    <ToolIcon name={tool.icon} size={15} />
                    {tool.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function ToolExplorer({ tools }: { tools: Tool[] }) {
  return (
    <Suspense>
      <ExplorerInner tools={tools} />
    </Suspense>
  );
}
