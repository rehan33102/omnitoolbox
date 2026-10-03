"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DollarSign, Globe, LayoutDashboard, Newspaper, Settings, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tools", label: "Tools Manager", icon: Wrench },
  { href: "/admin/blog", label: "Blog Manager", icon: Newspaper },
  { href: "/admin/settings", label: "Site & Social", icon: Settings },
  { href: "/admin/monetization", label: "Monetization", icon: DollarSign },
  { href: "/admin/seo", label: "SEO & Sitemap", icon: Globe },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:block w-56 shrink-0">
      <div className="glass rounded-2xl p-2 sticky top-24">
        <p className="px-3 py-2 text-[11px] uppercase tracking-widest text-zinc-500">Admin</p>
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition",
                active ? "bg-brand-600/20 text-white" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/5"
              )}
            >
              <l.icon size={16} />
              {l.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
