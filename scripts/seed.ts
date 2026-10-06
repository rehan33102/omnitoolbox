/**
 * Seed the database: tools, AI directory, blog posts, ad placements.
 * Run: npx tsx scripts/seed.ts
 */
import { createClient } from "@supabase/supabase-js";
import { TOOLS } from "../lib/tools-registry";
import { AI_TOOLS_SEED } from "../data/ai-tools-seed";
import { BLOG_SEED } from "../data/blog-templates";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Seeding tools…");
  await supabase.from("tools").upsert(
    TOOLS.map((t) => ({
      slug: t.slug, title: t.title, tagline: t.tagline, description: t.description,
      category: t.category, href: t.href, icon: t.icon, badge: t.badge ?? null,
      enabled: t.enabled, sort_order: t.sortOrder,
    })),
    { onConflict: "slug" }
  );

  console.log("Seeding AI directory…");
  await supabase.from("ai_tools").upsert(
    AI_TOOLS_SEED.map((t) => ({
      slug: t.slug, name: t.name, tagline: t.tagline, description: t.description,
      url: t.url, affiliate_url: t.affiliateUrl ?? null, category: t.category,
      tags: t.tags, votes: t.votes, featured: t.featured,
    })),
    { onConflict: "slug", ignoreDuplicates: true }
  );

  console.log("Seeding blog…");
  await supabase.from("blog_posts").upsert(
    BLOG_SEED.map((p) => ({
      slug: p.slug, title: p.title, excerpt: p.excerpt, body: p.body,
      tags: p.tags, reading_minutes: p.readingMinutes,
      published_at: p.publishedAt, updated_at: p.updatedAt,
    })),
    { onConflict: "slug", ignoreDuplicates: true }
  );

  console.log("Seeding ad placements…");
  const placements = [
    "homepage-top", "homepage-mid", "homepage-bottom",
    "prompt-studio-mid", "media-tools-bottom", "social-tools-bottom",
    "directory-top", "directory-bottom", "directory-detail",
    "blog-top", "blog-article",
  ];
  await supabase.from("ad_configs").upsert(
    placements.map((placement) => ({ placement, type: "adsense", slot_id: "", enabled: false })),
    { onConflict: "placement", ignoreDuplicates: true }
  );

  console.log(" Seed complete. Add your AdSense slot IDs in /admin → Monetization.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
