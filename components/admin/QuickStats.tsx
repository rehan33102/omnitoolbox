"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Megaphone, Users, Wrench } from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { getEnabledTools } from "@/lib/tools-registry";

/**
 * Quick stat cards with REAL counts. Each card links to a real admin page.
 * NOT mounted anywhere — the parent mounts this on the admin dashboard.
 */
interface Stat {
  label: string;
  href: string;
  icon: typeof Wrench;
  value: number | null; // null = still loading
}

export default function QuickStats() {
  const [stats, setStats] = useState<Stat[]>([
    { label: "Tools", href: "/admin/tools", icon: Wrench, value: getEnabledTools().length },
    { label: "Blog posts", href: "/admin/blog", icon: FileText, value: null },
    { label: "Ad placements", href: "/admin/monetization", icon: Megaphone, value: null },
    { label: "Users", href: "/admin/users", icon: Users, value: null },
  ]);

  useEffect(() => {
    let alive = true;
    const setValue = (label: string, value: number) =>
      setStats((ss) => (alive ? ss.map((s) => (s.label === label ? { ...s, value } : s)) : ss));

    (async () => {
      try {
        const r = await fetch("/api/admin/blog");
        if (r.ok) {
          const j = await r.json();
          setValue("Blog posts", Array.isArray(j.posts) ? j.posts.length : 0);
        } else setValue("Blog posts", 0);
      } catch {
        setValue("Blog posts", 0);
      }
    })();

    (async () => {
      try {
        const r = await fetch("/api/admin/ads");
        if (r.ok) {
          const j = await r.json();
          setValue("Ad placements", Array.isArray(j.ads) ? j.ads.length : 0);
        } else setValue("Ad placements", 0);
      } catch {
        setValue("Ad placements", 0);
      }
    })();

    (async () => {
      try {
        const r = await fetch("/api/admin/stats");
        if (r.ok) {
          const j = await r.json();
          setValue("Users", typeof j.totalUsers === "number" ? j.totalUsers : 0);
        } else setValue("Users", 0);
      } catch {
        setValue("Users", 0);
      }
    })();

    return () => { alive = false; };
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Link key={s.label} href={s.href} className="block group">
            <Card className="!py-4 transition group-hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </span>
                <div className="min-w-0">
                  {s.value === null ? (
                    <Skeleton className="h-7 w-12 rounded" />
                  ) : (
                    <p className="font-display text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</p>
                  )}
                  <p className="text-xs text-zinc-500">{s.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
