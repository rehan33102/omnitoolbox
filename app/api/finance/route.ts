import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { financeDb, scopeFilter, FINANCE_CURRENCIES } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const listQuery = z.object({
  viewer: z.string().min(1).max(64),
  userId: z.string().max(64).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().max(60).optional(),
  search: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const createBody = z.object({
  viewer: z.string().min(1).max(64),
  userId: z.string().max(64).optional(),
  type: z.enum(["income", "expense"]),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.enum(FINANCE_CURRENCIES as unknown as [string, ...string[]]).default("PKR"),
  category: z.string().min(1).max(60).default("Other"),
  note: z.string().max(280).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** List transactions with optional filters. Never throws on missing table. */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`finance:list:${ip}`, 120)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const q = listQuery.safeParse(params);
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400, headers: noStore });

  const { viewer, userId, month, type, category, search, limit } = q.data;
  try {
    const db = financeDb();
    let query = db
      .from("finance_transactions")
      .select("*")
      .or(scopeFilter({ viewerId: viewer, userId: userId ?? null }))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (month) query = query.gte("date", `${month}-01`).lt("date", nextMonth(month));
    if (type) query = query.eq("type", type);
    if (category) query = query.eq("category", category);
    if (search) query = query.ilike("note", `%${search.replace(/[%_]/g, "")}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ transactions: data ?? [] }, { headers: noStore });
  } catch {
    // Any backend failure (missing tables, config, network) → setup guidance, never a crash.
    return NextResponse.json({ setupRequired: true, transactions: [] }, { headers: noStore });
  }
}

/** Create a transaction. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`finance:write:${ip}`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }
  const body = createBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid transaction", details: body.error.flatten() }, { status: 400, headers: noStore });
  }
  const d = body.data;
  try {
    const db = financeDb();
    const { data, error } = await db
      .from("finance_transactions")
      .insert({
        viewer_id: d.viewer,
        user_id: d.userId ?? null,
        type: d.type,
        amount: d.amount,
        currency: d.currency,
        category: d.category,
        note: d.note || null,
        date: d.date,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ transaction: data }, { headers: noStore });
  } catch {
    // Any backend failure → setup guidance, never a crash.
    return NextResponse.json({ setupRequired: true }, { status: 503, headers: noStore });
  }
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1); // m is 0-based next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
