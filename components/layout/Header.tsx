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

        <nav className="hidden xl:flex items-center gap-1 ml-4">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "group relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  active
                    ? "text-white bg-gradient-to-r from-ember-500 to-magent-500 shadow-glow-warm scale-[1.02]"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-gradient-to-r hover:from-ember-500/10 hover:to-magent-500/10 hover:shadow-md hover:-translate-y-px"
                )}
              >
                <ToolIcon
                  name={l.icon}
                  size={15}
                  className={cn(
                    "transition-transform duration-200",
                    active ? "scale-110" : "group-hover:scale-110 group-hover:rotate-6"
                  )}
                />
                {l.label}
                {active && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-white/80" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block w-48 focus-within:w-72 transition-[width] duration-300">
            <SmartSearch tools={tools} variant="compact" />
          </div>
          <ThemeToggle />
          <button
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="xl:hidden p-2.5 rounded-xl glass hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title={settings.siteName}>
        <div className="mb-4">
          <SmartSearch tools={tools} variant="compact" onNavigate={() => setDrawer(false)} />
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setDrawer(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors",
                pathname === l.href ? "bg-brand-600/20 text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/5"
              )}
            >
              <ToolIcon name={l.icon} size={17} />
              {l.label}
            </Link>
          ))}
        </nav>
      </Drawer>
    </header>
  );
}
