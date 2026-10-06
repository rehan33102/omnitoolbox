"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import type { HealthCheck } from "@/app/api/admin/health/route";

export default function AdminHealthPage() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      const json = await res.json();
      setChecks(json.checks ?? []);
      setCheckedAt(json.checkedAt ?? null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const allOk = checks.length > 0 && checks.every((c) => c.ok);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">System health</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {checkedAt ? `Last checked ${new Date(checkedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Running live checks…"}
          </p>
        </div>
        <Button type="button" onClick={() => load(false)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {!loading && checks.length > 0 && (
        <Card>
          <div className="flex items-center gap-2">
            {allOk ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <p className="font-medium text-sm">
              {allOk ? "All systems operational" : "Some checks failed"}
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))
        ) : (
          checks.map((c) => (
            <Card key={c.name} className="!py-3">
              <div className="flex items-center gap-3">
                {c.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{c.name}</p>
                    <Badge variant={c.ok ? "new" : "pdf"}>{c.ok ? "OK" : "FAIL"}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 break-words">{c.detail}</p>
                </div>
                <span className="text-xs text-zinc-500 shrink-0 tabular-nums">{c.ms}ms</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
