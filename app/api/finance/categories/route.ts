import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { financeDb, isBackendUnavailable, scopeFilter } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const query = z.object({
  viewer: z.string().min(1).max(64),
  userId: z.string().max(64).optional(),
});

const createBody = z.object({
  viewer: z.string().min(1).max(64),
  userId: z.string().max(64).optional(),
  name: z.string().min(1).max(40).trim(),
  type: z.enum(["income", "expense"]),
});

/** Custom categories for this visitor. */
export async function GET(req: NextRequest) {
  const q = query.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400, headers: noStore });
  try {
    const { data, error } = await financeDb()
      .from("finance_categories")
      .select("id,name,type")
      .or(scopeFilter({ viewerId: q.data.viewer, userId: q.data.userId ?? null }))
      .order("name");
    if (error) {
      if (isBackendUnavailable(error)) {
        return NextResponse.json({ setupRequired: true, categories: [] }, { headers: noStore });
      }
      throw error;
    }
    return NextResponse.json({ categories: data ?? [] }, { headers: noStore });
  } catch {
    return NextResponse.json({ setupRequired: true, categories: [] }, { headers: noStore });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`finance:write:${ip}`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }
  const body = createBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid category" }, { status: 400, headers: noStore });
  const d = body.data;
  try {
    const { data, error } = await financeDb()
      .from("finance_categories")
      .upsert(
        { viewer_id: d.viewer, user_id: d.userId ?? null, name: d.name, type: d.type },
        { onConflict: "viewer_id,name,type" }
      )
      .select("id,name,type")
      .single();
    if (error) {
      if (isBackendUnavailable(error)) {
        return NextResponse.json({ setupRequired: true }, { status: 503, headers: noStore });
      }
      throw error;
    }
    return NextResponse.json({ category: data }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Failed to save category" }, { status: 500, headers: noStore });
  }
}
