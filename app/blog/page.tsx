import { buildMetadata, websiteJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import BlogListClient from "@/components/blog/BlogListClient";
import DynamicAdSlot from "@/components/layout/DynamicAdSlot";
import Badge from "@/components/ui/Badge";
import { getPosts } from "@/lib/blog";

export const revalidate = 600;

export const metadata = buildMetadata({
  title: "Blog — Guides, Tutorials & AI Tool Reviews",
  description: "Actionable guides on AI prompts, image optimization, social media growth and the best new AI tools.",
  path: "/blog",
  keywords: ["ai blog", "prompt engineering guide", "image optimization", "social media tips"],
});

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="container py-10">
      <JsonLd data={[
        websiteJsonLd(),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]),
      ]} />

      <div className="max-w-3xl mb-8">
        <Badge variant="ai" className="mb-4">Blog</Badge>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          Guides & <span className="text-gradient">tutorials</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          Deep, practical guides on AI prompts, image optimization and social growth —
          written to actually help, not to rank and bounce.
        </p>
      </div>

      <DynamicAdSlot placement="blog-top" format="horizontal" className="mb-8" />

      <BlogListClient initialPosts={posts} />
    </div>
  );
}
