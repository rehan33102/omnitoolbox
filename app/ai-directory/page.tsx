import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import DirectoryExplorer from "@/components/directory/DirectoryExplorer";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";
import { getListings } from "@/lib/get-directory";

export const revalidate = 300;

export const metadata = buildMetadata({
  title: "AI Tools Directory — Discover New AI Tools, Voted by the Community",
  description: "Browse newly launched AI tools across video, audio, coding, productivity and more. Community-voted rankings, updated daily.",
  path: "/ai-directory",
  keywords: ["ai tools directory", "new ai tools", "best ai tools 2026", "ai tools list"],
});

export default async function DirectoryPage() {
  const tools = await getListings();

  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox AI Directory", description: "Community-voted directory of new AI tools.", url: serverSiteUrl("/ai-directory"), category: "ai" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AI Directory", path: "/ai-directory" }]),
      ]} />
      <TrackUsage slug="ai-directory" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="ai">AI Directory</Badge>
          <Badge variant="new">{tools.length} tools listed</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          Discover new <span className="text-gradient">AI tools</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          New AI tools across video, audio, coding and productivity.
        </p>
      </div>


      <DirectoryExplorer tools={tools} />

    </div>
  );
}
