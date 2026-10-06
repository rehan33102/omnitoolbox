"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Eye, MousePointerClick } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import StatCard from "@/components/admin/StatCard";
import Badge from "@/components/ui/Badge";
import { formatCompact } from "@/lib/utils";

const tooltipStyle = {
  backgroundColor: "#14141f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  fontSize: "12px",
};

interface PerTool {
  slug: string;
  title: string;
  href: string | null;
  views: number;
  uses: number;
}

interface StatsData {
  totals: { toolUses: number; pageViews: number; ctr: number };
  perTool: PerTool[];
}

export default function ToolsAnalyticsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <Card><p className="text-sm text-zinc-500">Could not load analytics. Please retry.</p></Card>;
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

  const totals = data.totals ?? { toolUses: 0, pageViews: 0, ctr: 0 };
  const perTool = data.perTool ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 mb-2">
          <ArrowLeft size={12} /> Back to overview
        </Link>
        <h1 className="font-display text-2xl font-bold">Tool usage</h1>
        <p className="text-sm text-zinc-500">Last 14 days · per-tool breakdown from real analytics events</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tool uses (7d)" value={formatCompact(totals.toolUses ?? 0)} icon={MousePointerClick} />
        <StatCard label="Page views (7d)" value={formatCompact(totals.pageViews ?? 0)} icon={Eye} />
        <StatCard label="Tool CTR" value={`${(totals.ctr ?? 0).toFixed(1)}%`} icon={MousePointerClick} />
      </div>

      <Card>
        <h2 className="font-display font-semibold mb-4">Uses by tool</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perTool.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="title" width={150} tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="uses" name="Uses" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="font-display font-semibold mb-4">All tools</h2>
        <div className="space-y-2">
          {perTool.map((t, i) => {
            const row = (
              <div className="flex items-center justify-between glass rounded-xl px-3 py-2.5 text-sm gap-3">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-zinc-500 font-mono text-xs w-6 shrink-0">#{i + 1}</span>
                  <span className="truncate">{t.title}</span>
                  {t.href && <ArrowUpRight size={13} className="text-zinc-500 shrink-0" />}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <Badge variant="ai">{formatCompact(t.uses)} uses</Badge>
                  <Badge>{formatCompact(t.views)} views</Badge>
                </span>
              </div>
            );
            return t.href ? (
              <Link key={t.slug} href={t.href} className="block hover:opacity-80 transition-opacity">{row}</Link>
            ) : (
              <div key={t.slug}>{row}</div>
            );
          })}
          {perTool.length === 0 && (
            <p className="text-sm text-zinc-500">No usage data yet — events appear here once visitors use the tools.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
