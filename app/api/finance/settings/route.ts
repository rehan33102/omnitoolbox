import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { financeDb, isBackendUnavailable, FINANCE_CURRENCIES } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const query = z.object({
  viewer: z.string().min(1).max(64),
});

const saveBody = z.object({
  viewer: z.string().min(1).max(64),
  userId: z.string().max(64).optional(),
  currency: z.enum(FINANCE_CURRENCIES as unknown as [string, ...string[]]),
});

/** Get this visitor's display currency (defaults to PKR). */
export async function GET(req: NextRequest) {
  const q = query.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400, headers: noStore });
  try {
    const { data, error } = await financeDb()
      .from("finance_settings")
      .select("currency")
      .eq("viewer_id", q.data.viewer)
      .maybeSingle();
    if (error) {
      if (isBackendUnavailable(error)) {
        return NextResponse.json({ setupRequired: true, currency: "PKR" }, { headers: noStore });
      }
      throw error;
    }
    return NextResponse.json({ currency: data?.currency ?? "PKR" }, { headers: noStore });
  } catch {
    return NextResponse.json({ currency: "PKR" }, { headers: noStore });
  }
}

/** Save this visitor's display currency. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`finance:write:${ip}`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }
  const body = saveBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400, headers: noStore });
  const d = body.data;
  try {
    const { error } = await financeDb()
      .from("finance_settings")
      .upsert({ viewer_id: d.viewer, user_id: d.userId ?? null, currency: d.currency }, { onConflict: "viewer_id" });
    if (error) {
      if (isBackendUnavailable(error)) {
        return NextResponse.json({ setupRequired: true }, { status: 503, headers: noStore });
      }
      throw error;
    }
    return NextResponse.json({ ok: true, currency: d.currency }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500, headers: noStore });
  }
}
