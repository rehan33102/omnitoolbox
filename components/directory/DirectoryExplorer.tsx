"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import DirectoryCard from "./DirectoryCard";
import { cn } from "@/lib/utils";
import type { AIToolListing } from "@/types";

type Sort = "votes" | "newest" | "az";

export default function DirectoryExplorer({ tools }: { tools: AIToolListing[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("votes");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tools.filter(
      (t) =>
        (cat === "all" || t.category === cat) &&
        (!q || `${t.name} ${t.tagline} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(q))
    );
    return [...list].sort((a, b) =>
      sort === "votes" ? b.votes - a.votes :
      sort === "newest" ? +new Date(b.createdAt) - +new Date(a.createdAt) :
      a.name.localeCompare(b.name)
    );
  }, [tools, query, cat, sort]);

  const cats = ["all", ...new Set(tools.map((t) => t.category))];

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search AI tools…"
            className="input-base !pl-10"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input-base md:w-44">
          <option value="votes">Top voted</option>
          <option value="newest">Newest</option>
          <option value="az">A – Z</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn("btn-base px-3.5 py-1.5 text-xs rounded-full border capitalize",
              cat === c ? "bg-brand-600 text-white border-brand-500 shadow-glow" : "glass text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
          >
            {c === "all" ? "All tools" : c}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((t) => <DirectoryCard key={t.slug} tool={t} />)}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-zinc-500 py-16">No tools found. Try another search.</p>
      )}
    </div>
  );
}
