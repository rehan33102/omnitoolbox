import { createAdminClient } from "@/lib/supabase/admin";
import { AI_TOOLS_SEED } from "@/data/ai-tools-seed";
import type { AIToolListing } from "@/types";

function rowToListing(r: Record<string, unknown>): AIToolListing {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    tagline: (r.tagline as string) ?? "",
    description: (r.description as string) ?? "",
    url: r.url as string,
    affiliateUrl: (r.affiliate_url as string) ?? undefined,
    category: (r.category as string) ?? "general",
    tags: (r.tags as string[]) ?? [],
    votes: (r.votes as number) ?? 0,
    featured: (r.featured as boolean) ?? false,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function getListings(): Promise<AIToolListing[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("ai_tools").select("*").order("votes", { ascending: false });
    if (data && data.length > 0) return data.map(rowToListing);
  } catch { /* fall through to seed */ }
  return [...AI_TOOLS_SEED].sort((a, b) => b.votes - a.votes);
}

export async function getListing(slug: string): Promise<AIToolListing | null> {
  const all = await getListings();
  return all.find((l) => l.slug === slug) ?? null;
}
