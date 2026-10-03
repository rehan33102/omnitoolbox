/**
 * lib/admin-blog.ts — blog posts created/edited in /admin/blog.
 *
 * Saved to IndexedDB (records store, kind "blog-posts", one row keyed by slug)
 * + localStorage mirror. Merged over BLOG_SEED / Supabase posts at render time,
 * so publishing from the admin panel shows the post on /blog instantly.
 * A null publishedAt means "draft" (hidden from the public blog).
 */
import { getNamedRecord, listNamedRecords, saveNamedRecord, deleteNamedRecord } from "@/lib/db";
import { BLOG_SEED } from "@/data/blog-templates";
import type { BlogPost } from "@/types";

const KIND = "blog-posts";
export const ADMIN_BLOG_EVENT = "otb:admin-blog-updated";

export function notifyAdminBlog() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_BLOG_EVENT));
  }
}

export async function listAdminPosts(): Promise<BlogPost[]> {
  const rows = await listNamedRecords<BlogPost>(KIND);
  return rows.map((r) => r.data);
}

export async function getAdminPost(slug: string): Promise<BlogPost | null> {
  return getNamedRecord<BlogPost>(KIND, slug);
}

export async function saveAdminPost(post: BlogPost): Promise<void> {
  await saveNamedRecord<BlogPost>(KIND, post.slug, { ...post, updatedAt: new Date().toISOString() });
  notifyAdminBlog();
}

export async function deleteAdminPost(slug: string): Promise<void> {
  await deleteNamedRecord(KIND, slug);
  notifyAdminBlog();
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/**
 * Merge seed posts with admin posts. Admin posts override seeds with the same
 * slug; drafts (publishedAt === null) are excluded; sorted newest first.
 */
export function mergeBlogPosts(seed: BlogPost[], admin: BlogPost[]): BlogPost[] {
  const bySlug = new Map<string, BlogPost>();
  for (const p of seed) bySlug.set(p.slug, p);
  for (const p of admin) {
    if (p.publishedAt) bySlug.set(p.slug, p);
    else bySlug.delete(p.slug); // draft hides the seed version too
  }
  return [...bySlug.values()].sort(
    (a, b) => +new Date(b.publishedAt ?? b.updatedAt) - +new Date(a.publishedAt ?? a.updatedAt)
  );
}

/** Every known post including drafts (for the admin list view). */
export function allBlogPostsForAdmin(admin: BlogPost[]): BlogPost[] {
  const bySlug = new Map<string, BlogPost>();
  for (const p of BLOG_SEED) bySlug.set(p.slug, p);
  for (const p of admin) bySlug.set(p.slug, p);
  return [...bySlug.values()].sort(
    (a, b) => +new Date(b.publishedAt ?? b.updatedAt) - +new Date(a.publishedAt ?? a.updatedAt)
  );
}
