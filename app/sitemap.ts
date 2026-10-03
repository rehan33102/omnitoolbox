import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";
import { TOOLS } from "@/lib/tools-registry";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 3600; // regenerate at most once per hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: { route: string; priority: number; freq: "daily" | "weekly" | "monthly" }[] = [
    { route: "", priority: 1, freq: "daily" },
    { route: "/ai-prompt-studio", priority: 0.9, freq: "weekly" },
    { route: "/ai-voiceover", priority: 0.9, freq: "weekly" },
    { route: "/media-tools", priority: 0.9, freq: "weekly" },
    { route: "/pdf-tools", priority: 0.9, freq: "weekly" },
    { route: "/social-tools", priority: 0.9, freq: "weekly" },
    { route: "/web-tools", priority: 0.9, freq: "weekly" },
    { route: "/ai-directory", priority: 0.9, freq: "daily" },
    { route: "/blog", priority: 0.8, freq: "daily" },
    { route: "/privacy", priority: 0.3, freq: "monthly" },
    { route: "/terms", priority: 0.3, freq: "monthly" },
    { route: "/contact", priority: 0.4, freq: "monthly" },
  ];

  const urls: MetadataRoute.Sitemap = staticRoutes.map(({ route, priority, freq }) => ({
    url: siteUrl(route || "/"),
    lastModified: new Date(),
    changeFrequency: freq,
    priority,
  }));

  for (const tool of TOOLS.filter((t) => t.enabled)) {
    urls.push({
      url: siteUrl(tool.href),
      lastModified: new Date(tool.updatedAt),
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  // Dynamic: published blog posts + AI directory listings (build-safe fallback)
  try {
    const supabase = createAdminClient();
    const [{ data: posts }, { data: listings }] = await Promise.all([
      supabase.from("blog_posts").select("slug, updated_at").not("published_at", "is", null),
      supabase.from("ai_tools").select("slug, created_at"),
    ]);
    posts?.forEach((p) =>
      urls.push({
        url: siteUrl(`/blog/${p.slug}`),
        lastModified: new Date(p.updated_at),
        changeFrequency: "monthly",
        priority: 0.7,
      })
    );
    listings?.forEach((l) =>
      urls.push({
        url: siteUrl(`/ai-directory/${l.slug}`),
        lastModified: new Date(l.created_at),
        changeFrequency: "weekly",
        priority: 0.7,
      })
    );
  } catch {
    /* DB unreachable during build — static routes still ship */
  }

  return urls;
}
