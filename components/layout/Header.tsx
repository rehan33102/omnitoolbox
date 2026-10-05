"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV_LINKS } from "@/lib/constants";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { cn } from "@/lib/utils";
import Drawer from "@/components/ui/Drawer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import SmartSearch from "@/components/home/SmartSearch";
import LogoMark from "@/components/layout/LogoMark";
import ProfileMenu from "@/components/layout/ProfileMenu";
import ToolIcon from "@/components/ui/ToolIcon";
import type { Tool } from "@/types";

export default function Header() {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const { settings } = useSiteSettings();

  // Lazy-load the tool list for the smart search dropdown (small payload, cached).
  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then((j) => setTools(j.tools ?? []))
      .catch(() => {});
  }, []);

  return (
    <header id="site-header" className="sticky top-0 z-50 glass-strong border-b border-black/10 dark:border-white/10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <span className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
            <LogoMark size={42} />
          </span>
          <span className="brand-name">
            {settings.logoText}
          </span>
        </Link>

        {/* Nike-style clean nav: text only, underline on hover, with tool dropdowns */}
        <nav className="hidden 2xl:flex items-center gap-7 ml-10">
          {NAV_LINKS.slice(0, 6).map((l) => {
            const active = pathname === l.href;
            // Map nav links to tool categories for hover dropdowns
            const categoryMap: Record<string, string> = {
              "/media-tools": "image",
              "/pdf-tools": "pdf",
              "/social-tools": "social",
              "/web-tools": "web",
              "/ai-prompt-studio": "ai",
              "/ai-voiceover": "ai",
            };
            const cat = categoryMap[l.href];
            const catTools = cat ? tools.filter((t) => t.category === cat).slice(0, 8) : [];

            return (
              <div key={l.href} className="relative group">
                <Link
                  href={l.href}
                  className={cn(
                    "relative text-[15px] font-medium tracking-tight transition-colors whitespace-nowrap py-1 block",
                    "after:absolute after:bottom-0 after:left-0 after:h-[2px] after:bg-current after:transition-all after:duration-200",
                    active
                      ? "text-zinc-900 dark:text-white after:w-full"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white after:w-0 group-hover:after:w-full"
                  )}
                >
                  {l.label}
                </Link>
                {/* Hover dropdown with tools in this category */}
                {catTools.length > 0 && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-2 min-w-[260px]">
                      <Link
                        href={l.href}
                        className="block px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                      >
                        View all {l.label} →
                      </Link>
                      <div className="border-t border-black/5 dark:border-white/5 mt-1 pt-1">
                        {catTools.map((t) => (
                          <Link
                            key={t.slug}
                            href={t.href || `/tools/${t.slug}`}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white"
                          >
                            <ToolIcon name={t.icon} size={16} />
                            <span className="truncate">{t.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* "More" dropdown for remaining links */}
          <div className="relative group">
            <button className="relative text-[15px] font-medium tracking-tight text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap py-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-current group-hover:after:w-full after:transition-all after:duration-200">
              More
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-2 min-w-[220px]">
                {NAV_LINKS.slice(6).map((l) => {
                  const active = pathname === l.href;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
                        active
                          ? "bg-black/5 dark:bg-white/10 text-zinc-900 dark:text-white"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white"
                      )}
                    >
                      <ToolIcon name={l.icon} size={16} />
                      {l.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block w-48 focus-within:w-72 transition-[width] duration-300">
            <SmartSearch tools={tools} variant="compact" />
          </div>
          <ThemeToggle />
          <ProfileMenu />
          <button
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="2xl:hidden p-2.5 rounded-xl glass hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title={settings.siteName}>
        <div className="mb-5">
          {tools.length > 0 ? (
            <SmartSearch tools={tools} variant="compact" onNavigate={() => setDrawer(false)} />
          ) : (
            <div className="p-4 text-center text-sm text-zinc-500">Loading search...</div>
          )}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-3 px-1">
          Menu
        </p>
        <nav className="flex flex-col gap-2">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setDrawer(false)}
              className={cn(
                "group flex items-center gap-3.5 px-3 py-2.5 rounded-2xl transition-all duration-200",
                pathname === l.href
                  ? "bg-gradient-to-r from-brand-600/20 to-accent-500/10 border border-brand-500/30"
                  : "border border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:border-black/10 dark:hover:border-white/10 hover:translate-x-1"
              )}
            >
              <span className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl border transition-transform duration-200 group-hover:scale-110",
                pathname === l.href
                  ? "bg-gradient-to-br from-brand-500 to-accent-500 border-brand-400/40 text-white shadow-lg"
                  : "bg-black/[0.04] dark:bg-white/[0.07] border-black/10 dark:border-white/10 text-zinc-600 dark:text-zinc-300"
              )}>
                <ToolIcon name={l.icon} size={19} />
              </span>
              <span className={cn(
                "font-display font-semibold text-[15px] tracking-tight",
                pathname === l.href ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-200"
              )}>
                {l.label}
              </span>
              {pathname === l.href && (
                <span className="ml-auto size-2 rounded-full bg-brand-500" />
              )}
            </Link>
          ))}
        </nav>
      </Drawer>
    </header>
  );
}
