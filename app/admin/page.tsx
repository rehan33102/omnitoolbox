"use client";

import { useEffect, useState } from "react";
import { Activity, Eye, MousePointerClick, Radio, Users } from "lucide-react";
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
  liveVisitors?: number;
  totalUsers?: number;
}

const tooltipStyle = {
  backgroundColor: "#14141f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  fontSize: "12px",
};

interface LiveStats {
  liveVisitors: number;
  hourlyUses: number;
  hourlyViews: number;
  signups24h: number;
  totalUsers: number;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [live, setLive] = useState<LiveStats | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [dbStatus, setDbStatus] = useState<Record<string, boolean> | null>(null);
  const [dbBusy, setDbBusy] = useState(false);

  const loadStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      /* keep old data on poll failure */
    }
  };

  useEffect(() => {
    loadStats();
    // Full stats refresh every 60s as a fallback; live numbers come via SSE.
    const t = setInterval(loadStats, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time live stats via Server-Sent Events (no manual reload needed).
  useEffect(() => {
    const es = new EventSource("/api/admin/live-stats");
    es.onopen = () => setLiveConnected(true);
    es.onmessage = (e) => {
      try {
        const json = JSON.parse(e.data);
        if (json.type === "live-stats") {
          setLive(json);
          setLiveConnected(true);
        }
      } catch {
        /* ignore malformed chunks */
      }
    };
    es.onerror = () => setLiveConnected(false);
    return () => es.close();
  }, []);

  useEffect(() => {
    fetch("/api/admin/setup-database")
      .then((r) => r.json())
      .then((j) => setDbStatus(j.tables))
      .catch(() => {});
  }, []);

  const setupDb = async () => {
    setDbBusy(true);
    try {
      const res = await fetch("/api/admin/setup-database", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        alert("Database setup ho gaya! ✅ Ab real readings ayengi.");
        window.location.reload();
      } else {
        alert("Kuch tables nahi bane. Supabase dashboard mein SQL manually run karna hoga.");
      }
    } catch {
      alert("Setup failed. Try again.");
    } finally {
      setDbBusy(false);
    }
  };

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

  const totals = data.totals ?? { visitors: 0, pageViews: 0, toolUses: 0, ctr: 0, deltas: {} };
  const daily = data.daily ?? [];
  const topTools = data.topTools ?? [];
  // Prefer SSE live numbers when connected; fall back to polled stats.
  const liveVisitors = live?.liveVisitors ?? data.liveVisitors ?? 0;
  const totalUsers = live?.totalUsers ?? data.totalUsers ?? 0;

  const missingTables = dbStatus ? Object.entries(dbStatus).filter(([, v]) => !v).map(([k]) => k) : [];

  return (
    <div className="space-y-6">
      {missingTables.length > 0 && (
        <Card className="border-2 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-amber-700 dark:text-amber-400">⚠️ Database Setup Chahiye</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Ye tables missing hain: {missingTables.join(", ")}. Bina inke dashboard mein real readings nahi ayengi.
              </p>
            </div>
            <button
              onClick={setupDb}
              disabled={dbBusy}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg hover:shadow-xl transition disabled:opacity-50 whitespace-nowrap"
            >
              {dbBusy ? "Setup ho raha..." : "🔧 Database Setup Karo"}
            </button>
          </div>
        </Card>
      )}

      {/* Live visitors banner — real-time via SSE */}
      <Card className="!p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${liveConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${liveConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
          </span>
          <div>
            <p className="font-bold text-lg leading-none">
              {liveVisitors} <span className="text-sm font-medium text-zinc-500">live visitor{liveVisitors === 1 ? "" : "s"} on site</span>
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {liveConnected ? "● LIVE — streaming every 5s" : "○ connecting…"} · {live?.hourlyUses ?? 0} tool uses / hour · {live?.signups24h ?? 0} signups / 24h
            </p>
          </div>
        </div>
        <Radio size={20} className={liveConnected ? "text-emerald-500" : "text-amber-500"} />
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Visitors" value={formatCompact(totals.visitors ?? 0)} delta={totals.deltas?.visitors} icon={Users} />
        <StatCard label="Page views" value={formatCompact(totals.pageViews ?? 0)} delta={totals.deltas?.pageViews} icon={Eye} />
        <StatCard label="Tool uses" value={formatCompact(totals.toolUses ?? 0)} delta={totals.deltas?.toolUses} icon={MousePointerClick} />
        <StatCard label="Tool CTR" value={`${(totals.ctr ?? 0).toFixed(1)}%`} delta={totals.deltas?.ctr} icon={Activity} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Registered users" value={formatCompact(totalUsers)} icon={Users} />
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
