"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/analytics/visitors", label: "Visitors" },
  { href: "/admin/analytics/tools", label: "Tools" },
  { href: "/admin/analytics/users", label: "Users" },
  { href: "/admin/analytics/locations", label: "Location History" },
];

/**
 * Section nav for the analytics area. Rendered at the top of each analytics
 * page so the sub-pages (Visitors, Tools, Users, Location History) link to
 * each other consistently.
 */
export default function AnalyticsSectionNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Analytics sections" className="flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
