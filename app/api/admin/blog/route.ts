import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";
import { guardApi } from "@/lib/api-security";
import { BLOG_SEED } from "@/data/blog-templates";
import type { BlogPost } from "@/types";

const postSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  excerpt: z.string().max(400).default(""),
  body: z.string().min(1),
  tags: z.array(z.string().max(40)).max(15).default([]),
  readingMinutes: z.number().int().min(1).max(120).default(5),
  published: z.boolean().default(true),
});

const patchSchema = postSchema.partial().extend({ slug: z.string().min(1).max(80) });

function rowToPost(r: Record<string, unknown>): BlogPost {
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    excerpt: (r.excerpt as string) ?? "",
    body: (r.body as string) ?? "",
    tags: (r.tags as string[]) ?? [],
    readingMinutes: (r.reading_minutes as number) ?? 5,
    publishedAt: (r.published_at as string) ?? null,
    updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
  };
}

async function guard(req: NextRequest) {
  // 3.3 hardening first: 30 req/min per IP + same-origin enforcement,
  // so unauthenticated floods are throttled before any auth/DB work.
  const sec = guardApi(req, { key: "admin:blog", max: 30 });
  if (sec) return sec;
  if (!(await requireAdminApi())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

function revalidateBlog(slug?: string) {
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");
}

/** GET — all posts for the admin list: DB rows overlaid on the built-in seeds. */
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const supabase = createAdminClient();
  const { data } = await supabase.from("blog_posts").select("*").order("updated_at", { ascending: false });
  const bySlug = new Map<string, BlogPost>(BLOG_SEED.map((p) => [p.slug, p]));
  const tombstoned = new Set<string>();
  for (const r of data ?? []) {
    const post = rowToPost(r);
    if (post.publishedAt || post.body) bySlug.set(post.slug, post);
    else tombstoned.add(post.slug); // hidden seed
  }
  const posts = [...bySlug.values()]
    .filter((p) => !tombstoned.has(p.slug))
    .sort((a, b) => +new Date(b.publishedAt ?? b.updatedAt) - +new Date(a.publishedAt ?? a.updatedAt));
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const p = parsed.data;
  const supabase = createAdminClient();
  const { error } = await supabase.from("blog_posts").upsert(
    {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || p.title,
      body: p.body,
      tags: p.tags,
      reading_minutes: p.readingMinutes,
      published_at: p.published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  revalidateBlog(p.slug);
  return NextResponse.json({ ok: true, slug: p.slug });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { slug, readingMinutes, published, ...rest } = parsed.data;
  const payload: Record<string, unknown> = { slug, updated_at: new Date().toISOString() };
  if (readingMinutes !== undefined) payload.reading_minutes = readingMinutes;
  if (published !== undefined) payload.published_at = published ? new Date().toISOString() : null;
  for (const [k, v] of Object.entries(rest)) { if (v !== undefined) payload[k] = v; }
  const supabase = createAdminClient();
  const { error } = await supabase.from("blog_posts").upsert(payload, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  revalidateBlog(slug);
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/blog?slug=… — removes the post everywhere.
 * Built-in seed posts are hidden via a tombstone row (published_at = null);
 * re-adding the same slug restores them.
 */
export async function DELETE(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const supabase = createAdminClient();
  const { error: delError } = await supabase.from("blog_posts").delete().eq("slug", slug);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });
  // Tombstone so built-in seed posts stay hidden after "deletion".
  await supabase.from("blog_posts").insert({
    slug,
    title: slug,
    excerpt: "",
    body: "",
    tags: [],
    reading_minutes: 5,
    published_at: null,
  });
  revalidateBlog(slug);
  return NextResponse.json({ ok: true });
}
