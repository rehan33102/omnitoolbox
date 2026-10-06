import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { getKV, setKV } from "@/lib/kv";
import { siteUrl } from "@/lib/utils";

/**
 * GET /api/admin/health — REAL system checks, each measured live.
 * Every check: { name, ok, detail, ms }. Nothing is faked; failures are reported.
 */
export const dynamic = "force-dynamic";

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}

const TIMEOUT_MS = 8000;

async function timed(name: string, fn: () => Promise<{ ok: boolean; detail: string }>): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { ok, detail } = await fn();
    return { name, ok, detail, ms: Date.now() - start };
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : "Unknown error", ms: Date.now() - start };
  }
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:health", max: 10 });
  if (sec) return sec;
  if (!(await requirePermission("health"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Derive the base URL from the incoming request — never from
  // NEXT_PUBLIC_SITE_URL (unset/wrong env var was the "Homepage: fetch
  // failed" bug: it fell back to http://localhost:3000).
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const base = host ? `${proto}://${host}` : siteUrl();

  const checks: HealthCheck[] = await Promise.all([
    timed("Homepage", async () => {
      const t = withTimeout(TIMEOUT_MS);
      try {
        const res = await fetch(`${base}/`, { signal: t.signal, cache: "no-store" });
        return {
          ok: res.status === 200,
          detail: res.status === 200 ? `HTTP 200 from ${base}` : `HTTP ${res.status}`,
        };
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return { ok: false, detail: `Timed out after ${TIMEOUT_MS}ms` };
        }
        throw e;
      } finally {
        t.done();
      }
    }),

    timed("App version API", async () => {
      const t = withTimeout(TIMEOUT_MS);
      try {
        const res = await fetch(`${base}/api/app-version`, { signal: t.signal, cache: "no-store" });
        if (res.status !== 200) return { ok: false, detail: `HTTP ${res.status}` };
        const json = await res.json().catch(() => ({}));
        const version = json.versionName ?? json.version ?? "unknown";
        return { ok: true, detail: `HTTP 200, version ${version}` };
      } finally {
        t.done();
      }
    }),

    timed("KV read/write roundtrip", async () => {
      const probe = `health-probe-${Date.now()}`;
      const wrote = await setKV("health_check", { probe, at: new Date().toISOString() });
      if (!wrote) return { ok: false, detail: "KV write failed" };
      const back = await getKV<{ probe?: string }>("health_check", {});
      return back.probe === probe
        ? { ok: true, detail: "seo_settings write + read matched" }
        : { ok: false, detail: "KV read did not return the written value" };
    }),

    timed("Analytics table", async () => {
      const supabase = createAdminClient();
      const { error } = await supabase.from("analytics_events").select("id", { head: true, count: "exact" });
      return error
        ? { ok: false, detail: error.message }
        : { ok: true, detail: "analytics_events reachable" };
    }),

    timed("Supabase auth", async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) return { ok: false, detail: error.message };
      const total = data && "total" in data ? data.total : "?";
      return { ok: true, detail: `auth admin API reachable (${total} total users)` };
    }),
  ]);

  const allOk = checks.every((c) => c.ok);
  return NextResponse.json({ ok: allOk, checkedAt: new Date().toISOString(), checks });
}
