"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, MapPin, User } from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import AnalyticsSectionNav from "@/components/admin/AnalyticsSectionNav";

const PAGE_SIZE = 20;

interface LocationRow {
  id: string;
  created_at: string;
  latitude: number;
  longitude: number;
  country: string | null;
  city: string | null;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
}

interface LocationsResponse {
  rows: LocationRow[];
  total: number;
  limit: number;
  offset: number;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Reverse-geocode cache (in-memory, per page load). Nominatim is free for
 * light use; we cache by rounded coords and never refetch the same spot. */
const geoCache = new Map<string, string>();

function useReverseGeocode(lat: number, lng: number): string | null {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
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

function LocationTableRow({ row }: { row: LocationRow }) {
  const identity = row.user_id
    ? { title: row.user_name || row.user_email || "Logged-in visitor", sub: row.user_email || null }
    : { title: "Someone", sub: null };
  const address = useReverseGeocode(row.latitude, row.longitude);
  const latLng = `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`;

  return (
    <tr className="border-b border-black/5 dark:border-white/5 last:border-0">
      <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
      <td className="py-2.5 pr-4">
        <span className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300">
            <User size={13} />
          </span>
          <span className="min-w-0">
            <span className="block font-medium truncate">{identity.title}</span>
            {identity.sub && <span className="block text-xs text-zinc-500 truncate">{identity.sub}</span>}
          </span>
        </span>
      </td>
      <td className="py-2.5 pr-4 font-mono text-xs whitespace-nowrap" title="Coordinates (5 decimals)">
        {latLng}
      </td>
      <td className="py-2.5 pr-4 text-sm text-zinc-500 max-w-[240px] truncate" title={address ?? undefined}>
        {address ?? "Resolving address…"}
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap">
        <a
          href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${latLng} on Google Maps`}
          className="inline-flex items-center gap-1 text-sm text-brand-700 dark:text-brand-400 hover:underline font-medium"
        >
          Map <ExternalLink size={12} />
        </a>
      </td>
      <td className="py-2.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
          <MapPin size={13} className="text-emerald-500" />
          Precise — user allowed
        </span>
      </td>
    </tr>
  );
}

export default function LocationsAnalyticsPage() {
  const [data, setData] = useState<LocationsResponse | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    fetch(`/api/admin/analytics/locations?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("request failed"))))
      .then((j: LocationsResponse) => setData(j))
      .catch(() => setError(true));
  }, [page]);

  if (error) {
    return <Card><p className="text-sm text-zinc-500">Could not load location history. Please retry.</p></Card>;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const total = data.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1) + 1;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 mb-2">
          <ArrowLeft size={12} /> Back to overview
        </Link>
        <h1 className="font-display text-2xl font-bold">Location History</h1>
        <p className="text-sm text-zinc-500">Every precise location a visitor opted into sharing — permanent log, newest first.</p>
        <div className="mt-3">
          <AnalyticsSectionNav />
        </div>
      </div>

      <Card>
        {total === 0 ? (
          <div className="py-10 text-center">
            <p className="font-display font-semibold text-lg mb-1">No locations captured yet</p>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Precise locations only appear here when a visitor explicitly allows location access
              in their browser. Until then, this log stays empty — nothing is deleted or expires.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-zinc-500 border-b border-black/10 dark:border-white/10">
                    <th className="py-2 pr-4 font-medium">Captured</th>
                    <th className="py-2 pr-4 font-medium">Visitor</th>
                    <th className="py-2 pr-4 font-medium">Coordinates</th>
                    <th className="py-2 pr-4 font-medium">Address</th>
                    <th className="py-2 pr-4 font-medium">Map</th>
                    <th className="py-2 font-medium">Precision</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <LocationTableRow key={r.id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
              <span>
                {total.toLocaleString()} {total === 1 ? "location" : "locations"} · page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
