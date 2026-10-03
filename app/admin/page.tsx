"use client";

import { useEffect, useState } from "react";
import { Activity, Eye, MousePointerClick, Users } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import StatCard from "@/components/admin/StatCard";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { formatCompact } from "@/lib/utils";

interface StatsData {
  totals: { visitors: number; pageViews: number; toolUses: number; ctr: number; deltas: Record<string, number> };
  daily: { date: string; views: number; uses: number }[];
  topTools: { slug: string; title: string; uses: number }[];
}

const tooltipStyle = {
  backgroundColor: "#14141f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  fontSize: "12px",
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { totals, daily, topTools } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Visitors" value={formatCompact(totals.visitors)} delta={totals.deltas.visitors} icon={Users} />
        <StatCard label="Page views" value={formatCompact(totals.pageViews)} delta={totals.deltas.pageViews} icon={Eye} />
        <StatCard label="Tool uses" value={formatCompact(totals.toolUses)} delta={totals.deltas.toolUses} icon={MousePointerClick} />
        <StatCard label="Tool CTR" value={`${totals.ctr.toFixed(1)}%`} delta={totals.deltas.ctr} icon={Activity} />
      </div>

      <Card>
        <h2 className="font-display font-semibold mb-1">Traffic — last 14 days</h2>
        <p className="text-xs text-zinc-500 mb-4">Page views vs tool uses per day</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="views" name="Views" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} />
              <Area type="monotone" dataKey="uses" name="Tool uses" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-display font-semibold mb-4">Most used tools</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTools.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="title" width={120} tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="uses" name="Uses" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="font-display font-semibold mb-4">Top tools table</h2>
          <div className="space-y-2">
            {topTools.slice(0, 8).map((t, i) => (
              <div key={t.slug} className="flex items-center justify-between glass rounded-xl px-3 py-2.5 text-sm">
                <span className="flex items-center gap-3">
                  <span className="text-zinc-500 font-mono text-xs w-5">#{i + 1}</span>
                  <span className="truncate">{t.title}</span>
                </span>
                <Badge variant="ai">{formatCompact(t.uses)} uses</Badge>
              </div>
            ))}
            {topTools.length === 0 && (
              <p className="text-sm text-zinc-500">No usage data yet — events appear here once visitors use the tools.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
