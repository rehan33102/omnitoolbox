"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Eye, Globe, MapPin, User, Users } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import StatCard from "@/components/admin/StatCard";
import { formatCompact } from "@/lib/utils";

const tooltipStyle = {
  backgroundColor: "#14141f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  fontSize: "12px",
};

interface StatsData {
  totals: { visitors: number; pageViews: number };
  daily: { date: string; views: number; visitors: number }[];
  liveVisitors?: number;
  geoEnabled?: boolean;
  topCountries?: { country: string; city: string | null; visitors: number }[];
}

interface LiveVisitor {
  viewer: string;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  lastActive: string;
}

interface LiveStats {
  liveVisitors: number;
  liveList: LiveVisitor[];
  geoEnabled: boolean;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function locationLabel(v: LiveVisitor): string {
  if (v.city && v.country) return `${v.city}, ${v.country}`;
  if (v.country) return v.country;
  return "Unknown";
}

/** Reverse-geocode cache (in-memory, per page load). Nominatim is free for
 * light use; we cache by rounded coords and never refetch the same spot. */
const geoCache = new Map<string, string>();

function useReverseGeocode(lat: number | null, lng: number | null): string | null {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = geoCache.get(key);
    if (cached) {
      setAddress(cached);
      return;
    }
    let cancelled = false;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=14`,
      { headers: { Accept: "application/json" } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const display: string | undefined = j.display_name;
        if (display) {
          // Shorten: keep the most specific parts (road, suburb, city).
          const parts = display.split(",").map((s: string) => s.trim()).filter(Boolean);
          const short = parts.slice(0, 3).join(", ");
          geoCache.set(key, short);
          setAddress(short);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);
  return address;
}

function VisitorRow({ v }: { v: LiveVisitor }) {
  const identity = v.userId
    ? { title: v.userName || v.userEmail || "Logged-in visitor", sub: v.userEmail || null, anonymous: false }
    : { title: "Someone using website", sub: null, anonymous: true };
  const precise = typeof v.latitude === "number" && typeof v.longitude === "number";
  const address = useReverseGeocode(v.latitude, v.longitude);

  return (
    <div className="flex items-center justify-between gap-3 glass rounded-xl px-3 py-2.5 text-sm">
      <span className="flex items-center gap-3 min-w-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300">
          <User size={15} />
        </span>
        <span className="min-w-0">
          <span className="block font-medium truncate">{identity.title}</span>
          {identity.sub && <span className="block text-xs text-zinc-500 truncate">{identity.sub}</span>}
          {precise && (
            <span className="block text-xs text-zinc-500 truncate" title={address ?? undefined}>
              {address ?? `${v.latitude?.toFixed(5)}, ${v.longitude?.toFixed(5)}`}
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0 text-xs text-zinc-500">
        {precise ? (
          <>
            <MapPin size={13} className="text-emerald-500" />
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Precise (user allowed)</span>
            <a
              href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open precise location on Google Maps`}
              className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-400 hover:underline font-medium"
            >
              Map <ExternalLink size={12} />
            </a>
          </>
        ) : (
          <>
            <Globe size={13} />
            <span>Approximate (IP-based) · {locationLabel(v)}</span>
          </>
        )}
        <span className="text-zinc-400">· {formatTime(v.lastActive)}</span>
      </span>
    </div>
  );
}

export default function VisitorsAnalyticsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [live, setLive] = useState<LiveStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setError(true));
  }, []);

  // Real-time live visitor list via SSE.
  useEffect(() => {
    const es = new EventSource("/api/admin/live-stats");
    es.onmessage = (e) => {
      try {
        const json = JSON.parse(e.data);
        if (json.type === "live-stats") setLive(json);
      } catch {
        /* ignore malformed chunks */
      }
    };
    return () => es.close();
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

  const daily = data.daily ?? [];
  const totals = data.totals ?? { visitors: 0, pageViews: 0 };
  const geoEnabled = data.geoEnabled ?? live?.geoEnabled ?? false;
  const topCountries = data.topCountries ?? [];
  const liveList = live?.liveList ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 mb-2">
          <ArrowLeft size={12} /> Back to overview
        </Link>
        <h1 className="font-display text-2xl font-bold">Visitors & page views</h1>
        <p className="text-sm text-zinc-500">Last 14 days · all numbers from real analytics events</p>
        <p className="text-xs text-zinc-400 mt-1">Coarse IP-based location (country/city) — no GPS, no permission asked.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Visitors (7d)" value={formatCompact(totals.visitors ?? 0)} icon={Users} />
        <StatCard label="Page views (7d)" value={formatCompact(totals.pageViews ?? 0)} icon={Eye} />
        <StatCard label="Live visitors" value={formatCompact(live?.liveVisitors ?? data.liveVisitors ?? 0)} icon={Users} />
      </div>

      {/* Live visitor list — identity + location, streaming via SSE */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold">Live now</h2>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>
        <p className="text-xs text-zinc-500 mb-4">Visitors active in the last 5 minutes</p>
        {!geoEnabled && (
          <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
            <p className="font-medium mb-1">Location columns missing in the database.</p>
            <p className="mb-2">Run this SQL once in Supabase Dashboard → SQL Editor, then reload:</p>
            <pre className="bg-black/40 rounded-lg p-2 overflow-x-auto text-[11px] leading-relaxed select-all">
{`alter table analytics_events
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists user_id text,
  add column if not exists user_email text,
  add column if not exists user_name text;`}
            </pre>
          </div>
        )}
        <div className="space-y-2">
          {liveList.map((v) => (
            <VisitorRow key={v.viewer} v={v} />
          ))}
          {liveList.length === 0 && (
            <p className="text-sm text-zinc-500 py-2">No visitors on the site right now.</p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-display font-semibold mb-1">Traffic — last 14 days</h2>
        <p className="text-xs text-zinc-500 mb-4">Visitors vs page views per day</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#34d399" fill="#34d399" fillOpacity={0.25} strokeWidth={2} />
              <Area type="monotone" dataKey="views" name="Page views" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top countries — real IP-based location data */}
      <Card>
        <h2 className="font-display font-semibold mb-1">Top countries</h2>
        <p className="text-xs text-zinc-500 mb-4">Distinct visitors by country/city · last 14 days</p>
        {!geoEnabled ? (
          <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
            Run the database setup SQL to enable location.
          </p>
        ) : topCountries.length === 0 ? (
          <p className="text-sm text-zinc-500">No location data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-zinc-500 border-b border-black/10 dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">Country</th>
                  <th className="py-2 pr-4 font-medium">City</th>
                  <th className="py-2 font-medium text-right">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {topCountries.map((c, i) => (
                  <tr key={`${c.country}-${c.city}-${i}`} className="border-b border-black/5 dark:border-white/5 last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{c.country}</td>
                    <td className="py-2.5 pr-4 text-zinc-500">{c.city || "—"}</td>
                    <td className="py-2.5 text-right font-semibold">{c.visitors.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display font-semibold mb-4">Per-day breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-zinc-500 border-b border-black/10 dark:border-white/10">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium text-right">Visitors</th>
                <th className="py-2 font-medium text-right">Page views</th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.date} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2.5 pr-4 text-zinc-500">{d.date}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold">{d.visitors.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-semibold">{d.views.toLocaleString()}</td>
                </tr>
              ))}
              {daily.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-zinc-500">No traffic data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
