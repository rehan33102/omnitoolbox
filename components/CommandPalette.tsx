"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import ToolIcon from "@/components/ui/ToolIcon";
import { cn } from "@/lib/utils";

interface PaletteTool {
  title: string;
  tagline: string;
  href: string;
  icon: string;
  keywords: string[];
}

interface PaletteItem {
  key: string;
  label: string;
  hint: string;
  href: string;
  icon: string;
  group: string;
}

/**
 * Command palette (Cmd+K / Ctrl+K). Searches all tools (via /api/tools)
 * plus main navigation pages. Not mounted by default — mount once in the
 * root layout, e.g. <CommandPalette />.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tools, setTools] = useState<PaletteTool[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const loadTools = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const res = await fetch("/api/tools", { cache: "no-store" });
      const data = await res.json();
      const list = (data?.tools ?? []) as PaletteTool[];
      setTools(list.filter((t) => t && t.href));
    } catch {
      /* palette still works with navigation items */
    }
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    void loadTools();
  }, [loadTools]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // Global hotkey: Cmd+K / Ctrl+K or "/" (not while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else openPalette();
        return;
      }
      if (e.key === "/" && !open && !typing) {
        e.preventDefault();
        openPalette();
      }
    };
    // Custom event so CommandPaletteButton (or anything else) can open the palette
    const onCustomOpen = () => openPalette();
    window.addEventListener("keydown", onKey);
    window.addEventListener("otb:open-palette", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("otb:open-palette", onCustomOpen);
    };
  }, [open, openPalette, close]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [open ]);

  const items: PaletteItem[] = useMemo(() => {
    const toolItems: PaletteItem[] = tools.map((t) => ({
      key: `tool-${t.title}`,
      label: t.title,
      hint: t.tagline || "",
      href: t.href,
      icon: t.icon || "Wrench",
      group: "Tools",
    }));
    const navItems: PaletteItem[] = NAV_LINKS.map((l) => ({
      key: `nav-${l.href}`,
      label: l.label,
      hint: "Go to page",
      href: l.href,
      icon: l.icon,
      group: "Pages",
    }));
    const q = query.trim().toLowerCase();
    if (!q) return [...toolItems.slice(0, 6), ...navItems];
    const matches = (i: PaletteItem, hay: string) =>
      i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q) || hay.toLowerCase().includes(q);
    const toolHay = new Map(tools.map((t) => [t.title, t.keywords.join(" ")]));
    return [
      ...toolItems.filter((i) => matches(i, toolHay.get(i.label) ?? "")),
      ...navItems.filter((i) => matches(i, "")),
    ].slice(0, 30);
  }, [tools, query]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  const onPaletteKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) go(item.href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  // Keep the active item visible
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  let lastGroup = "";
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[12vh]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Search tools and pages"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPaletteKey}
      >
        <div className="flex items-center gap-3 border-b border-black/10 dark:border-white/10 px-4">
          <Search size={18} className="shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, pages… (Esc to close)"
            className="w-full bg-transparent py-4 text-[15px] outline-none placeholder:text-zinc-400"
            aria-label="Search"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No results for “{query}”. Try a different keyword.
            </p>
          )}
          {items.map((item, idx) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {showGroup && (
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  data-index={idx}
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    idx === activeIndex
                      ? "bg-ember-500/10 text-zinc-900 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  <span className="shrink-0 text-zinc-400">
                    <ToolIcon name={item.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    {item.hint && <span className="block truncate text-xs opacity-70">{item.hint}</span>}
                  </span>
                  {idx === activeIndex && <CornerDownLeft size={14} className="shrink-0 text-zinc-400" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-black/10 dark:border-white/10 px-4 py-2.5 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/10 dark:border-white/10 px-1.5 py-0.5 font-mono">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/10 dark:border-white/10 px-1.5 py-0.5 font-mono">↵</kbd> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/10 dark:border-white/10 px-1.5 py-0.5 font-mono">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Search trigger button — place in the header area (parent decides).
 * Opens the palette on click; hidden label expands on desktop.
 */
export function CommandPaletteButton({ className }: { className?: string }) {
  const open = () => {
    window.dispatchEvent(new CustomEvent("otb:open-palette"));
  };
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search (Ctrl+K)"
      className={cn(
        "flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10",
        "bg-black/[0.03] dark:bg-white/[0.06] px-3 py-2 text-sm text-zinc-500",
        "hover:border-ember-500/50 transition-colors",
        className
      )}
    >
      <Search size={15} />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline rounded border border-black/10 dark:border-white/10 px-1.5 py-0.5 text-[10px] font-mono">
        Ctrl K
      </kbd>
    </button>
  );
}
