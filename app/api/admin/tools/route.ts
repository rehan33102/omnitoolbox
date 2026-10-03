import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";
import { mergeTools } from "@/lib/tools-registry";
import { slugify } from "@/lib/utils";

const toolSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  tagline: z.string().max(200).default(""),
  description: z.string().max(2000).default(""),
  category: z.enum(["ai", "image", "social", "web", "text"]).default("web"),
  href: z.string().max(200).default(""),
  icon: z.string().max(40).default("Wrench"),
  badge: z.enum(["new", "popular", "pro"]).nullable().optional(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(99),
});

const patchSchema = toolSchema.partial().extend({ slug: z.string().min(1).max(80) });

async function guard() {
  if (!(await requireAdminApi())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const supabase = createAdminClient();
  const { data } = await supabase.from("tools").select("*").order("sort_order");
  return NextResponse.json({ tools: mergeTools(data ?? []) });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = toolSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const t = parsed.data;
  const supabase = createAdminClient();
  const { error } = await supabase.from("tools").insert({
    slug: slugify(t.slug),
    title: t.title,
    tagline: t.tagline,
    description: t.description,
    category: t.category,
    href: t.href || `/${slugify(t.slug)}`,
    icon: t.icon,
    badge: t.badge ?? null,
    enabled: t.enabled,
    sort_order: t.sortOrder,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { slug, sortOrder, badge, ...rest } = parsed.data;
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = { slug, updated_at: new Date().toISOString() };
  if (sortOrder !== undefined) payload.sort_order = sortOrder;
  if (badge !== undefined) payload.badge = badge;
  for (const [k, v] of Object.entries(rest)) { if (v !== undefined) payload[k] = v; }
  const { error } = await supabase.from("tools").upsert(payload, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
