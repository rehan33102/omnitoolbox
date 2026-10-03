"use client";

import ArticleCard from "@/components/blog/ArticleCard";
import type { BlogPost } from "@/types";

/**
 * Blog list — renders the server-fetched posts. The admin CMS writes to the
 * database, so published posts are the same for every visitor (no
 * browser-local merging needed anymore).
 */
export default function BlogListClient({ initialPosts }: { initialPosts: BlogPost[] }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {initialPosts.map((p) => (
        <ArticleCard key={p.slug} post={p} />
      ))}
    </div>
  );
}
