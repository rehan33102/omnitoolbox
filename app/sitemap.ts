import type { MetadataRoute } from "next";
import { serverSiteUrl } from "@/lib/seo";
import { TOOLS } from "@/lib/tools-registry";
import { getPosts } from "@/lib/blog";
import { getListings } from "@/lib/get-directory";
import { getKV } from "@/lib/kv";

export const revalidate = 3600; // regenerate at most once per hour

export interface SitemapToggles {
  tools: boolean; // per-tool pages from the registry
  blog: boolean; // /blog index + published posts
  directory: boolean; // /ai-directory index + listings
}

const DEFAULT_TOGGLES: SitemapToggles = { tools: true, blog: true, directory: true };

async function getToggles(): Promise<SitemapToggles> {
  try {
    const t = await getKV<Partial<SitemapToggles>>("seo_sitemap", {});
    return { ...DEFAULT_TOGGLES, ...t };
  } catch {
    return DEFAULT_TOGGLES;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const toggles = await getToggles();

  const staticRoutes: { route: string; priority: number; freq: "daily" | "weekly" | "monthly"; section?: "blog" | "directory" }[] = [
    { route: "", priority: 1, freq: "daily" },
    { route: "/ai-prompt-studio", priority: 0.9, freq: "weekly" },
    { route: "/ai-voiceover", priority: 0.9, freq: "weekly" },
    { route: "/media-tools", priority: 0.9, freq: "weekly" },
    { route: "/pdf-tools", priority: 0.9, freq: "weekly" },
    { route: "/social-tools", priority: 0.9, freq: "weekly" },
    { route: "/web-tools", priority: 0.9, freq: "weekly" },
    { route: "/ai-directory", priority: 0.9, freq: "daily", section: "directory" },
    { route: "/calculators", priority: 0.9, freq: "weekly" },
    { route: "/download", priority: 0.8, freq: "weekly" },
    { route: "/tutorial", priority: 0.7, freq: "weekly" },
    { route: "/spotlight/voiceover", priority: 0.7, freq: "monthly" },
    { route: "/blog", priority: 0.8, freq: "daily", section: "blog" },
    { route: "/library", priority: 0.5, freq: "monthly" },
    { route: "/hire-me", priority: 0.4, freq: "monthly" },
    { route: "/contact", priority: 0.4, freq: "monthly" },
    { route: "/privacy", priority: 0.3, freq: "monthly" },
    { route: "/terms", priority: 0.3, freq: "monthly" },
  ];

  const urls: MetadataRoute.Sitemap = staticRoutes
    .filter(({ section }) => (section === "blog" ? toggles.blog : section === "directory" ? toggles.directory : true))
    .map(({ route, priority, freq }) => ({
      url: serverSiteUrl(route || "/"),
      lastModified: new Date(),
      changeFrequency: freq,
      priority,
    }));

  if (toggles.tools) {
    for (const tool of TOOLS.filter((t) => t.enabled)) {
      urls.push({
        url: serverSiteUrl(tool.href),
        lastModified: new Date(tool.updatedAt),
        changeFrequency: "weekly",
        priority: 0.85,
      });
    }
  }

  // Dynamic: published blog posts + AI directory listings — use the SAME
  // sources as the pages themselves (built-in seeds + DB overrides), because
  // the old Supabase-only query silently omitted every seed post the blog
  // index actually shows (8 posts were missing from the sitemap).
  try {
    const [posts, listings] = await Promise.all([
      toggles.blog ? getPosts() : Promise.resolve([]),
      toggles.directory ? getListings() : Promise.resolve([]),
    ]);
    posts.forEach((p) =>
      urls.push({
        url: serverSiteUrl(`/blog/${p.slug}`),
        lastModified: new Date(p.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
      })
    );
    listings.forEach((l) =>
      urls.push({
        url: serverSiteUrl(`/ai-directory/${l.slug}`),
        lastModified: new Date(l.createdAt),
        changeFrequency: "weekly",
        priority: 0.7,
      })
    );
  } catch {
    /* seeds unavailable — static routes still ship */
  }

  // Dedupe: the same URL must never appear twice (e.g. /ai-voiceover is
  // both a static route and a registry href).
  const seen = new Set<string>();
  return urls.filter((u) => {
    if (seen.has(u.url)) return false;
    seen.add(u.url);
    return true;
  });
}
