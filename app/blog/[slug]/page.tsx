import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { buildMetadata, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import ArticleBody from "@/components/blog/ArticleBody";
import ArticleCard from "@/components/blog/ArticleCard";
import AdminArticleFallback from "@/components/blog/AdminArticleFallback";
import Badge from "@/components/ui/Badge";
import { getPost, getPosts } from "@/lib/blog";
import { BLOG_SEED } from "@/data/blog-templates";

export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  return BLOG_SEED.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) return {};
  return buildMetadata({
    title: `${post.title} | OmniToolBox`,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    keywords: post.tags,
  });
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  // Admin-created posts live in IndexedDB/localStorage — render client-side.
  if (!post) return <AdminArticleFallback slug={params.slug} />;

  const all = await getPosts();
  const related = all.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="container py-10">
      <JsonLd data={[
        articleJsonLd(post),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ]),
      ]} />

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

        <div className="mt-8">
          <ArticleBody body={post.body} />
        </div>

      </div>

      {related.length > 0 && (
        <div className="max-w-5xl mx-auto mt-16">
          <h2 className="font-display text-xl font-bold mb-5">Keep reading</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {related.map((p) => <ArticleCard key={p.slug} post={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
