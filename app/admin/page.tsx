"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, Check, Eye, MousePointerClick, Radio, Users, Wrench } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import StatCard from "@/components/admin/StatCard";
import QuickStats from "@/components/admin/QuickStats";
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
  const [setupSql, setSetupSql] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

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
      // The app cannot run DDL itself — fetch the setup SQL so the admin can
      // run it once in Supabase Dashboard → SQL Editor. Honest, always works.
      const res = await fetch("/api/admin/setup-database?sql=1");
      const json = await res.json();
      if (json.sql) {
        setSetupSql(json.sql);
        setSqlCopied(false);
      }
    } catch {
      /* keep old data on failure */
    } finally {
      setDbBusy(false);
    }
  };

  const copySetupSql = async () => {
    if (!setupSql) return;
    try {
      await navigator.clipboard.writeText(setupSql);
      setSqlCopied(true);
    } catch {
      /* clipboard unavailable — user can select manually */
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
              <h3 className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2"><AlertTriangle size={18} /> Database Setup Required</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                These tables are missing: {missingTables.join(", ")}. Without them, the dashboard cannot show real readings.
              </p>
            </div>
            <button
              onClick={setupDb}
              disabled={dbBusy}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg hover:shadow-xl transition disabled:opacity-50 whitespace-nowrap"
            >
              {dbBusy ? "Setting up..." : (<span className="inline-flex items-center gap-2"><Wrench size={16} /> Set Up Database</span>)}
            </button>
          </div>
        </Card>
      )}

      {/* Setup SQL modal — the app cannot run DDL itself, so the admin copies
          the SQL and runs it once in Supabase Dashboard → SQL Editor. */}
      {setupSql && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSetupSql(null)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-black/5 dark:border-white/5">
              <h3 className="font-display font-bold">Run this SQL once in Supabase</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Supabase Dashboard → SQL Editor → paste → Run. Then refresh this page.
              </p>
            </div>
            <div className="p-5">
              <textarea readOnly value={setupSql} rows={12}
                className="w-full font-mono text-xs rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-3" />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setSetupSql(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition">
                  Close
                </button>
                <button onClick={copySetupSql}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow hover:shadow-lg transition">
                  {sqlCopied ? (<span className="inline-flex items-center gap-1.5"><Check size={14} /> Copied</span>) : "Copy SQL"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live visitors banner — real-time via SSE, clickable to the visitors detail page */}
      <Link href="/admin/analytics/visitors" aria-label="Live visitors — view details" className="group block rounded-3xl">
        <Card hover className="!p-4 flex items-center justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500/40 transition-shadow">
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
                <span className="ml-2 font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">View details →</span>
              </p>
            </div>
          </div>
          <span className="flex items-center gap-2">
            <ArrowUpRight size={16} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Radio size={20} className={liveConnected ? "text-emerald-500" : "text-amber-500"} />
          </span>
        </Card>
      </Link>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Visitors" value={formatCompact(totals.visitors ?? 0)} delta={totals.deltas?.visitors} icon={Users} href="/admin/analytics/visitors" />
        <StatCard label="Page views" value={formatCompact(totals.pageViews ?? 0)} delta={totals.deltas?.pageViews} icon={Eye} href="/admin/analytics/visitors" />
        <StatCard label="Tool uses" value={formatCompact(totals.toolUses ?? 0)} delta={totals.deltas?.toolUses} icon={MousePointerClick} href="/admin/analytics/tools" />
        <StatCard label="Tool CTR" value={`${(totals.ctr ?? 0).toFixed(1)}%`} delta={totals.deltas?.ctr} icon={Activity} href="/admin/analytics/tools" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Registered users" value={formatCompact(totalUsers)} icon={Users} href="/admin/analytics/users" />
      </div>

      {/* Content quick-stats: tools, blog posts, ads, users — real counts with working links */}
      <QuickStats />

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
