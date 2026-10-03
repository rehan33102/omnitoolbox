"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import ArticleBody from "@/components/blog/ArticleBody";
import Badge from "@/components/ui/Badge";
import { getAdminPost } from "@/lib/admin-blog";
import type { BlogPost } from "@/types";

/**
 * Renders an admin-created blog post when /blog/[slug] has no server-side post
 * for the slug (admin posts live in IndexedDB/localStorage, not the build).
 */
export default function AdminArticleFallback({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined);

  useEffect(() => {
    getAdminPost(slug).then((p) => setPost(p?.publishedAt ? p : null));
  }, [slug]);

  if (post === undefined) {
    return (
      <div className="container py-10 max-w-3xl mx-auto">
        <p className="text-sm text-zinc-500">Loading article…</p>
      </div>
    );
  }
  if (!post) notFound();

  return (
    <div className="container py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-6 transition">
          <ArrowLeft size={15} /> All articles
        </Link>
        <div className="flex gap-1.5 flex-wrap mb-4">
          {post.tags.map((t) => <Badge key={t} variant="ai">{t}</Badge>)}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
          {post.title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3 text-lg">{post.excerpt}</p>
        <div className="flex items-center gap-4 text-xs text-zinc-500 mt-4 pb-6 border-b border-black/10 dark:border-white/10">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {new Date(post.publishedAt ?? post.updatedAt).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} /> {post.readingMinutes} min read
          </span>
        </div>
        <ArticleBody body={post.body} />
      </div>
    </div>
  );
}
