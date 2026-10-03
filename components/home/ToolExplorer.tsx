"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import ToolCard from "./ToolCard";
import SectionHeader from "./SectionHeader";
import Badge from "@/components/ui/Badge";
import { Reveal } from "@/hooks/useReveal";
import { TOOL_CATEGORIES, type ToolCategoryId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Tool } from "@/types";

export default function ToolExplorer({ tools }: { tools: Tool[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"all" | ToolCategoryId>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter(
      (t) =>
        (cat === "all" || t.category === cat) &&
        (!q || `${t.title} ${t.tagline} ${t.description}`.toLowerCase().includes(q))
    );
  }, [tools, query, cat]);

  return (
    <section id="tools" className="container scroll-mt-24">
      <SectionHeader
        eyebrow="The collection"
        title={<>Find your <span className="text-gradient-warm">tool</span></>}
        sub={`Search across all ${tools.length} utilities — free forever, no signup.`}
      />

      <Reveal delay={100}>
        <div className="max-w-xl mx-auto relative mb-6">
          <Search size={17} className="absolute left-4 top-3.5 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools… (e.g. prompt, compress, hashtag)"
            className="input-base !pl-11 !py-3.5 !rounded-2xl !text-base"
          />
        </div>
      </Reveal>

      <Reveal delay={160}>
        <div className="flex flex-wrap justify-center gap-2 mb-10">
        <button
          onClick={() => setCat("all")}
          className={cn("btn-base px-4 py-2 text-sm rounded-full border",
            cat === "all" ? "bg-gradient-to-r from-ember-500 to-magent-500 text-white border-transparent shadow-glow-warm" : "glass text-zinc-400 hover:text-white")}
        >
          All <Badge variant="default" className="ml-1">{tools.length}</Badge>
        </button>
        {TOOL_CATEGORIES.map((c) => {
          const n = tools.filter((t) => t.category === c.id).length;
          if (!n) return null;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={cn("btn-base px-4 py-2 text-sm rounded-full border",
                cat === c.id ? "bg-gradient-to-r from-ember-500 to-magent-500 text-white border-transparent shadow-glow-warm" : "glass text-zinc-400 hover:text-white")}
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
        <div className="text-center py-16 text-zinc-500">
          <SearchX size={36} className="mx-auto mb-3" />
          <p>No tools match “{query}”. Try another keyword.</p>
        </div>
      )}
    </section>
  );
}
