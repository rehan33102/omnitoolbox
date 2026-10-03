import { createAdminClient } from "@/lib/supabase/admin";
import { BLOG_SEED } from "@/data/blog-templates";
import type { BlogPost } from "@/types";

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

export async function getPosts(): Promise<BlogPost[]> {
  // Built-in seeds are the base; database rows (admin CMS) override them by
  // slug. A DB row with published_at = null acts as a tombstone that hides
  // the matching seed (used when the admin "deletes" a built-in post).
  const bySlug = new Map<string, BlogPost>(BLOG_SEED.map((p) => [p.slug, p]));
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .order("published_at", { ascending: false });
    for (const r of data ?? []) {
      const post = rowToPost(r);
      if (post.publishedAt || post.body) bySlug.set(post.slug, post);
      else bySlug.delete(post.slug);
    }
  } catch { /* seeds only */ }
  return [...bySlug.values()]
    .filter((p) => p.publishedAt)
    .sort((a, b) => +new Date(b.publishedAt!) - +new Date(a.publishedAt!));
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}
