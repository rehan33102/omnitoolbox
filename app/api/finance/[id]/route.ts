import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { financeDb, isBackendUnavailable, scopeFilter, FINANCE_CURRENCIES } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const identity = z.object({
  viewer: z.string().min(1).max(64),
  userId: z.string().max(64).optional(),
});

const updateBody = z.object({
  viewer: z.string().min(1).max(64),
  userId: z.string().max(64).optional(),
  type: z.enum(["income", "expense"]).optional(),
  amount: z.number().positive().max(1_000_000_000).optional(),
  currency: z.enum(FINANCE_CURRENCIES as unknown as [string, ...string[]]).optional(),
  category: z.string().min(1).max(60).optional(),
  note: z.string().max(280).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Fetch the row only if it belongs to this visitor. */
async function ownedRow(id: string, viewer: string, userId?: string) {
  const db = financeDb();
  const { data, error } = await db
    .from("finance_transactions")
    .select("id")
    .eq("id", id)
    .or(scopeFilter({ viewerId: viewer, userId: userId ?? null }))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`finance:write:${ip}`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }
  const body = updateBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400, headers: noStore });
  }
  const { viewer, userId, ...fields } = body.data;
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400, headers: noStore });
  }
  try {
    const owned = await ownedRow(params.id, viewer, userId);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
    const { data, error } = await financeDb()
      .from("finance_transactions")
      .update(fields)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ transaction: data }, { headers: noStore });
  } catch (e) {
    if (isBackendUnavailable(e as { code?: string; message?: string })) {
      return NextResponse.json({ setupRequired: true }, { status: 503, headers: noStore });
    }
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500, headers: noStore });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`finance:write:${ip}`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }
  const q = identity.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid identity" }, { status: 400, headers: noStore });
  try {
    const owned = await ownedRow(params.id, q.data.viewer, q.data.userId);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
    const { error } = await financeDb().from("finance_transactions").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    if (isBackendUnavailable(e as { code?: string; message?: string })) {
      return NextResponse.json({ setupRequired: true }, { status: 503, headers: noStore });
    }
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500, headers: noStore });
  }
}
