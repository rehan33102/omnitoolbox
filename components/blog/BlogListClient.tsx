"use client";

import { useMemo } from "react";
import ArticleCard from "@/components/blog/ArticleCard";
import { useAdminBlogPosts } from "@/hooks/useAdminBlogPosts";
import { mergeBlogPosts } from "@/lib/admin-blog";
import type { BlogPost } from "@/types";

/**
 * Blog list — merges the server-fetched posts (Supabase/seed) with posts
 * created in /admin/blog (IndexedDB/localStorage), newest first.
 * Admin publishes show up instantly without a redeploy.
 */
export default function BlogListClient({ initialPosts }: { initialPosts: BlogPost[] }) {
  const { posts: adminPosts } = useAdminBlogPosts();
  const posts = useMemo(
    () => mergeBlogPosts(initialPosts, adminPosts),
    [initialPosts, adminPosts]
  );

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => (
        <ArticleCard key={p.slug} post={p} />
      ))}
    </div>
  );
}
