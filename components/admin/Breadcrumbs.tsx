"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

/** Admin breadcrumbs — derived from the URL path. Hidden on the dashboard root. */
const LABELS: Record<string, string> = {
  admin: "Dashboard",
  analytics: "Analytics",
  visitors: "Visitors",
  tools: "Tools",
  users: "Users",
  monetization: "Monetization",
  seo: "SEO",
  media: "Media",
  settings: "Settings",
  health: "Health",
  activity: "Activity",
  blog: "Blog",
  engagement: "Engagement",
  auth: "Sign in",
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // Don't show on the dashboard root or auth page.
  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
      <Link
        href="/admin"
        aria-label="Dashboard home"
        className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
      >
        <Home size={14} />
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
          {c.isLast ? (
            <span aria-current="page" className="font-medium text-zinc-800 dark:text-zinc-100">
              {c.label}
            </span>
          ) : (
            <Link href={c.href} className="rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-700 dark:hover:text-zinc-200 transition">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
