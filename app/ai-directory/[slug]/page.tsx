import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";
import JsonLd from "@/components/seo/JsonLd";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import VoteButtons from "@/components/directory/VoteButtons";
import DirectoryCard from "@/components/directory/DirectoryCard";
import DynamicAdSlot from "@/components/layout/DynamicAdSlot";
import TrackUsage from "@/components/analytics/TrackUsage";
import { getListing, getListings } from "@/lib/get-directory";
import { AI_TOOLS_SEED } from "@/data/ai-tools-seed";

export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  return AI_TOOLS_SEED.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const tool = await getListing(params.slug);
  if (!tool) return {};
  return buildMetadata({
    title: `${tool.name} — ${tool.tagline} | OmniToolBox`,
    description: tool.description.slice(0, 155),
    path: `/ai-directory/${tool.slug}`,
    keywords: [tool.name.toLowerCase(), ...tool.tags, "ai tool review"],
  });
}

export default async function ToolDetailPage({ params }: { params: { slug: string } }) {
  const tool = await getListing(params.slug);
  if (!tool) notFound();

  const all = await getListings();
  const related = all.filter((t) => t.slug !== tool.slug && t.category === tool.category).slice(0, 4);
  const visitUrl = tool.affiliateUrl ?? tool.url;

  return (
    <div className="container py-10 max-w-4xl">
      <JsonLd data={[
        softwareAppJsonLd({ name: tool.name, description: tool.description, url: siteUrl(`/ai-directory/${tool.slug}`), category: tool.category }),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "AI Directory", path: "/ai-directory" },
          { name: tool.name, path: `/ai-directory/${tool.slug}` },
        ]),
      ]} />
      <TrackUsage slug={`directory-${tool.slug}`} />

      <Link href="/ai-directory" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white mb-6 transition">
        <ArrowLeft size={15} /> Back to directory
      </Link>

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <VoteButtons slug={tool.slug} initialVotes={tool.votes} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="font-display text-2xl md:text-3xl font-extrabold">{tool.name}</h1>
              {tool.featured && <Badge variant="pro">Featured</Badge>}
            </div>
            <p className="text-brand-300 font-medium">{tool.tagline}</p>
            <p className="text-zinc-400 mt-3 leading-relaxed">{tool.description}</p>
            <div className="flex gap-1.5 mt-4 flex-wrap">
              <Badge variant="default">{tool.category}</Badge>
              {tool.tags.map((t) => <Badge key={t} variant="ai">#{t}</Badge>)}
            </div>
            <a href={visitUrl} target="_blank" rel="noopener sponsored" className="inline-block mt-6">
              <Button size="lg">Visit {tool.name} <ExternalLink size={16} /></Button>
            </a>
            {tool.affiliateUrl && (
              <p className="text-[11px] text-zinc-600 mt-2">Affiliate link — supports OmniToolBox at no cost to you.</p>
            )}
          </div>
        </div>
      </Card>

      <DynamicAdSlot placement="directory-detail" format="horizontal" className="mb-8" />

      {related.length > 0 && (
        <div>
          <h2 className="font-display text-xl font-bold mb-4">Related AI tools</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {related.map((t) => <DirectoryCard key={t.slug} tool={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}
