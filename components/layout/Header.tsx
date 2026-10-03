"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV_LINKS } from "@/lib/constants";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { cn } from "@/lib/utils";
import Drawer from "@/components/ui/Drawer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import SmartSearch from "@/components/home/SmartSearch";
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
    <header className="sticky top-0 z-50 glass-strong border-b border-black/10 dark:border-white/10">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <span className="relative grid h-10 w-10 place-items-center rounded-2xl overflow-hidden shadow-lg shadow-purple-500/25 ring-1 ring-black/10 dark:ring-white/20 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <Image
              src="/images/logo.png"
              alt="OmniToolBox logo"
              width={40}
              height={40}
              className="object-cover"
              priority
            />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-gradient drop-shadow-[0_1px_8px_rgba(168,85,247,0.35)]">
            {settings.logoText}
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ml-4">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === l.href
                  ? "text-zinc-900 dark:text-white bg-black/5 dark:bg-white/10"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/5"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block w-48 focus-within:w-72 transition-[width] duration-300">
            <SmartSearch tools={tools} variant="compact" />
          </div>
          <ThemeToggle />
          <button
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="lg:hidden p-2.5 rounded-xl glass hover:bg-black/5 dark:hover:bg-white/10 transition"
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
                "px-4 py-3 rounded-xl text-sm transition-colors",
                pathname === l.href ? "bg-brand-600/20 text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/5"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </Drawer>
    </header>
  );
}
