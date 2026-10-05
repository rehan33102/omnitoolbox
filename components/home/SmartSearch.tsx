"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, Sparkles, X } from "lucide-react";
import ToolIcon from "@/components/ui/ToolIcon";
import { CATEGORY_STYLE } from "./ToolCard";
import { findAlternatives, smartSearch } from "@/lib/smart-search";
import { useTrackToolUsage } from "@/hooks/useTrackToolUsage";
import { cn } from "@/lib/utils";
import type { Tool } from "@/types";

interface SmartSearchProps {
  tools: Tool[];
  /** "hero" = big glassy homepage search, "compact" = header search */
  variant?: "hero" | "compact";
  initialQuery?: string;
  /** Called on every keystroke so a parent grid can filter live. */
  onQueryChange?: (q: string) => void;
  /** e.g. close the mobile drawer after navigating */
  onNavigate?: () => void;
  /** called when the search dropdown opens/closes (for hiding overlapping UI) */
  onDropdownChange?: (open: boolean) => void;
}

/** Bold the first query-token occurrence inside the title. */
function highlightTitle(title: string, tokens: string[]) {
  const lower = title.toLowerCase();
  let bestIdx = -1;
  let bestLen = 0;
  for (const t of tokens) {
    if (!t) continue;
    const i = lower.indexOf(t);
    if (i >= 0 && (bestIdx < 0 || i < bestIdx)) {
      bestIdx = i;
      bestLen = t.length;
    }
  }
  if (bestIdx < 0) return title;
  return (
    <>
      {title.slice(0, bestIdx)}
      <mark className="bg-transparent text-zinc-900 dark:text-white font-bold">
        {title.slice(bestIdx, bestIdx + bestLen)}
      </mark>
      {title.slice(bestIdx + bestLen)}
    </>
  );
}

export default function SmartSearch({
  tools,
  variant = "hero",
  initialQuery = "",
  onQueryChange,
  onNavigate,
  onDropdownChange,
}: SmartSearchProps) {
  const router = useRouter();
  const { track } = useTrackToolUsage();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hero = variant === "hero";

  // Guard against undefined tools
  const safeTools = Array.isArray(tools) ? tools : [];

  const tokens = useMemo(() => query.toLowerCase().trim().split(/\s+/).filter(Boolean), [query]);
  const results = useMemo(() => {
    // Single-letter/short queries can match many tools — show more results
    const limit = query.trim().length <= 2 ? 12 : 6;
    try {
      return smartSearch(safeTools, query, limit);
    } catch {
      return [];
    }
  }, [safeTools, query]);
  const alternatives = useMemo(() => {
    try {
      return query.trim() && results.length === 0 ? findAlternatives(safeTools, query, 3) : [];
    } catch {
      return [];
    }
  }, [safeTools, query, results.length]);
  const flat = results.length > 0 ? results.map((r) => r.tool) : alternatives.map((a) => a.tool);

  useEffect(() => {
    onQueryChange?.(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => setActive(0), [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // "/" focuses the hero search
  useEffect(() => {
    if (!hero) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(el.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hero]);

  const go = (tool: Tool) => {
    track(tool.slug, "use");
    setOpen(false);
    onNavigate?.();
    router.push(tool.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && flat.length) {
      e.preventDefault();
      go(flat[Math.min(active, flat.length - 1)]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && query.trim().length > 0;

  // Notify parent when dropdown opens/closes (to hide overlapping UI)
  useEffect(() => {
    onDropdownChange?.(showDropdown);
  }, [showDropdown, onDropdownChange]);

  return (
    <div ref={rootRef} className={cn("relative", hero ? "w-full" : "w-full")}>
      {/* Glow backdrop on focus */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-1 rounded-[28px] bg-gradient-to-r from-ember-500/40 via-magent-500/30 to-ember-500/40 blur-xl transition-opacity duration-500",
          open && query ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      />
      <div className="relative">
        <Search
          size={hero ? 20 : 16}
          className={cn(
            "absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors",
            query && "text-ember-600 dark:text-ember-400",
            !hero && "left-3.5"
          )}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="smart-search-listbox"
          aria-label="Search tools"
          placeholder={hero ? "Search tools… try “photo maker”, “voice”, “qr”" : "Search tools…"}
          className={cn(
            "w-full bg-white/[0.05] backdrop-blur-xl border border-black/10 dark:border-white/10 text-zinc-900 dark:text-white",
            "placeholder:text-zinc-600 font-display tracking-tight",
            "transition-all duration-300",
            "focus:outline-none focus:border-ember-400/60 focus:bg-white/[0.07]",
            "focus:shadow-[0_0_50px_rgba(249,115,22,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]",
            hero
              ? "rounded-3xl pl-14 pr-24 py-4 md:py-5 text-base md:text-lg"
              : "rounded-2xl pl-10 pr-9 py-2.5 text-sm"
          )}
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition",
              hero ? "right-14" : "right-2.5"
            )}
          >
            <X size={hero ? 17 : 14} />
          </button>
        )}
        {hero && !query && (
          <kbd className="absolute right-5 top-1/2 -translate-y-1/2 hidden md:grid size-8 place-items-center rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 text-xs text-zinc-500">
            /
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div
          id="smart-search-listbox"
          role="listbox"
          className="absolute z-[60] left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-[#141419]/95 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        >
          {results.length > 0 ? (
            <ul className="max-h-[60vh] overflow-y-auto p-2">
              {results.map(({ tool }, i) => {
                const s = CATEGORY_STYLE[tool.category] ?? CATEGORY_STYLE.web;
                return (
                  <li key={tool.slug} role="option" aria-selected={i === active}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(tool)}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        i === active ? "bg-black/5 dark:bg-white/10" : "bg-transparent"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl border",
                          s.tile
                        )}
                      >
                        <ToolIcon name={tool.icon} size={18} className={s.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                          {highlightTitle(tool.title, tokens)}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {tool.tagline}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={15}
                        className={cn(
                          "shrink-0 transition-all",
                          i === active ? "text-zinc-900 dark:text-white opacity-100" : "text-zinc-600 opacity-0"
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : alternatives.length > 0 ? (
            <div className="p-2">
              <p className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                <Sparkles size={12} className="text-ember-600 dark:text-ember-400" />
                No exact match — did you mean / alternatives
              </p>
              <ul>
                {alternatives.map(({ tool }, i) => {
                  const s = CATEGORY_STYLE[tool.category] ?? CATEGORY_STYLE.web;
                  return (
                    <li key={tool.slug} role="option" aria-selected={i === active}>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(tool)}
                        onMouseEnter={() => setActive(i)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          i === active ? "bg-black/5 dark:bg-white/10" : "bg-transparent"
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-xl border",
                            s.tile
                          )}
                        >
                          <ToolIcon name={tool.icon} size={18} className={s.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                            {tool.title}
                          </span>
                          <span className="block truncate text-xs text-zinc-500">
                            {tool.tagline}
                          </span>
                        </span>
                        <ArrowUpRight
                          size={15}
                          className={cn(
                            "shrink-0 transition-all",
                            i === active ? "text-zinc-900 dark:text-white opacity-100" : "text-zinc-600 opacity-0"
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="px-5 py-6 text-center text-sm text-zinc-500">
              No results found for “{query.trim()}”. Try “qr”, “voice”, “pdf”, “blog”…
            </p>
          )}
          {flat.length > 0 && hero && (
            <p className="hidden md:block border-t border-black/5 dark:border-white/5 px-4 py-2 text-[11px] text-zinc-600">
              ↑↓ navigate · Enter to open · Esc to close
            </p>
          )}
        </div>
      )}
    </div>
  );
}
