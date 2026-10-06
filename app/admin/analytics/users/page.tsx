"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import StatCard from "@/components/admin/StatCard";
import { formatCompact } from "@/lib/utils";

interface RecentUser {
  email: string;
  created_at: string;
}

interface StatsData {
  totalUsers: number;
  signups24h: number;
  recentUsers: RecentUser[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function UsersAnalyticsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <Card><p className="text-sm text-zinc-500">Could not load user data. Please retry.</p></Card>;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const recentUsers = data.recentUsers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 mb-2">
          <ArrowLeft size={12} /> Back to overview
        </Link>
        <h1 className="font-display text-2xl font-bold">Registered users</h1>
        <p className="text-sm text-zinc-500">Real data from the auth user list</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total users" value={formatCompact(data.totalUsers ?? 0)} icon={Users} />
        <StatCard label="Signups (24h)" value={formatCompact(data.signups24h ?? 0)} icon={UserPlus} />
      </div>

      <Card>
        <h2 className="font-display font-semibold mb-1">Latest signups</h2>
        <p className="text-xs text-zinc-500 mb-4">Newest first · capped at 50</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-zinc-500 border-b border-black/10 dark:border-white/10">
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 font-medium text-right">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={`${u.email}-${u.created_at}`} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2.5 pr-4 truncate max-w-[220px]">{u.email || "—"}</td>
                  <td className="py-2.5 text-right text-zinc-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr><td colSpan={2} className="py-6 text-center text-zinc-500">No registered users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
