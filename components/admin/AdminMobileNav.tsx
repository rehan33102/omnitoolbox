"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DollarSign, Globe, LayoutDashboard, Newspaper, Settings, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tools", label: "Tools", icon: Wrench },
  { href: "/admin/blog", label: "Blog", icon: Newspaper },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/monetization", label: "Ads", icon: DollarSign },
  { href: "/admin/seo", label: "SEO", icon: Globe },
];

/**
 * Mobile-only admin navigation. The desktop sidebar is hidden on phones
 * (hidden md:block), so without this there is NO way to reach the
 * Tools/Blog/Settings pages on mobile — the exact bug the user reported.
 */
export default function AdminMobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden mb-5 -mx-1 px-1 overflow-x-auto" aria-label="Admin sections">
      <div className="flex gap-2 min-w-max pb-1">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition",
                active
                  ? "bg-brand-600/25 text-white ring-1 ring-brand-500/40"
                  : "bg-white/[0.04] text-zinc-400 ring-1 ring-white/10 active:bg-white/10"
              )}
            >
              <l.icon size={15} />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
