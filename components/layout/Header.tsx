"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Search, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Drawer from "@/components/ui/Drawer";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => setMounted(true), []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/?q=${encodeURIComponent(q.trim())}#tools`);
    setDrawer(false);
  };

  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-white/10">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 shadow-glow">
            <Sparkles size={18} className="text-white" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Omni<span className="text-gradient">ToolBox</span>
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
                  ? "text-white bg-white/10"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <form onSubmit={submitSearch} className="hidden md:flex items-center relative">
            <Search size={16} className="absolute left-3 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tools…"
              className="input-base !py-2 !pl-9 w-48 focus:w-64 transition-all"
            />
          </form>
          {mounted && (
            <button
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-xl glass hover:bg-white/10 transition"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
          <button
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="lg:hidden p-2.5 rounded-xl glass hover:bg-white/10 transition"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title={SITE_NAME}>
        <form onSubmit={submitSearch} className="relative mb-4">
          <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tools…"
            className="input-base !pl-9"
          />
        </form>
        <nav className="flex flex-col gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setDrawer(false)}
              className={cn(
                "px-4 py-3 rounded-xl text-sm transition-colors",
                pathname === l.href ? "bg-brand-600/20 text-white" : "text-zinc-400 hover:bg-white/5"
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
