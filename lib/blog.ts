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
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });
    if (data && data.length > 0) return data.map(rowToPost);
  } catch { /* fall through */ }
  return [...BLOG_SEED].sort((a, b) => +new Date(b.publishedAt!) - +new Date(a.publishedAt!));
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}
