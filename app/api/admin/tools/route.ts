import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { mergeTools } from "@/lib/tools-registry";
import { slugify } from "@/lib/utils";

const toolSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  tagline: z.string().max(200).default(""),
  description: z.string().max(2000).default(""),
  category: z.enum(["ai", "image", "social", "web", "text", "pdf"]).default("web"),
  href: z.string().max(200).default(""),
  icon: z.string().max(40).default("Wrench"),
  image: z.string().max(500).default(""),
  keywords: z.array(z.string().max(60)).max(30).default([]),
  badge: z.enum(["new", "popular", "pro"]).nullable().optional(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(99),
});

const patchSchema = toolSchema.partial().extend({ slug: z.string().min(1).max(80) });

/** Columns that exist in the original 002_tools migration. */
const CORE_COLUMNS = new Set([
  "slug", "title", "tagline", "description", "category", "href",
  "icon", "badge", "enabled", "sort_order",
]);

/**
 * Upsert a tool row. If the CMS migration (007_tools_cms: image, keywords,
 * is_deleted) hasn't been applied yet, Postgres raises 42703 — retry with
 * only the core columns so the save still succeeds.
 */
async function resilientUpsert(payload: Record<string, unknown>) {
  const supabase = createAdminClient();
  let res = await supabase.from("tools").upsert(payload, { onConflict: "slug" });
  if (res.error && (res.error.code === "42703" || /does not exist/i.test(res.error.message))) {
    const stripped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (CORE_COLUMNS.has(k) || k === "updated_at") stripped[k] = v;
    }
    res = await supabase.from("tools").upsert(stripped, { onConflict: "slug" });
  }
  return res;
}

async function guard(req: NextRequest) {
  // 3.3 hardening first: 30 req/min per IP + same-origin enforcement,
  // so unauthenticated floods are throttled before any auth/DB work.
  const sec = guardApi(req, { key: "admin:tools", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("tools"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const supabase = createAdminClient();
  const { data } = await supabase.from("tools").select("*").order("sort_order");
  // mergeTools skips soft-deleted rows; admin list shows the rest.
  return NextResponse.json({ tools: mergeTools(data ?? []) });
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = toolSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const t = parsed.data;
  const slug = slugify(t.slug);
  const { error } = await resilientUpsert({
    slug,
    title: t.title,
    tagline: t.tagline,
    description: t.description,
    category: t.category,
    href: t.href || `/tools/${slug}`,
    icon: t.icon,
    image: t.image,
    keywords: t.keywords,
    badge: t.badge ?? null,
    enabled: t.enabled,
    sort_order: t.sortOrder,
    is_deleted: false, // re-adding a soft-deleted tool restores it
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, slug });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { slug, sortOrder, badge, keywords, ...rest } = parsed.data;
  const payload: Record<string, unknown> = { slug, updated_at: new Date().toISOString() };
  if (sortOrder !== undefined) payload.sort_order = sortOrder;
  if (badge !== undefined) payload.badge = badge;
  if (keywords !== undefined) payload.keywords = keywords;
  for (const [k, v] of Object.entries(rest)) { if (v !== undefined) payload[k] = v; }
  const { error } = await resilientUpsert(payload);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/tools?slug=… — soft-delete. Built-in (registry) tools are
 * hidden via is_deleted; re-adding the same slug restores them. Falls back to
 * enabled=false when the CMS migration hasn't been applied yet.
 */
export async function DELETE(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await resilientUpsert({
    slug,
    is_deleted: true,
    enabled: false,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
