import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import FancyTextStylator from "@/components/social/FancyTextStylator";
import BioGenerator from "@/components/social/BioGenerator";
import HashtagFinder from "@/components/social/HashtagFinder";
import DynamicAdSlot from "@/components/layout/DynamicAdSlot";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";

export const metadata = buildMetadata({
  title: "Free Social Media Tools — Fancy Text, Bio Generator & Hashtag Finder",
  description: "Style text with 12 unicode fonts, generate converting Instagram/TikTok bios, and find high-reach hashtags. Free, no signup.",
  path: "/social-tools",
  keywords: ["fancy text generator", "instagram bio generator", "tiktok bio ideas", "hashtag generator", "unicode text styler"],
});

export default function SocialToolsPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox Social Tools", description: "Free social media growth utilities.", url: serverSiteUrl("/social-tools"), category: "social" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Social Tools", path: "/social-tools" }]),
      ]} />
      <TrackUsage slug="social-tools" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="social">Social Tools</Badge>
          <Badge variant="new">Growth kit</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          Social Media <span className="text-gradient">Growth Suite</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          Fancy unicode text, scroll-stopping bios and high-reach hashtags —
          everything you need to grow on Instagram & TikTok.
        </p>
      </div>

      <Tabs defaultValue="fancy">
        <TabsList>
          <TabsTrigger value="fancy">Fancy Text</TabsTrigger>
          <TabsTrigger value="bio">Bio Generator</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtag Finder</TabsTrigger>
        </TabsList>
        <TabsContent value="fancy" id="fancy-text"><FancyTextStylator /></TabsContent>
        <TabsContent value="bio" id="bio-generator"><BioGenerator /></TabsContent>
        <TabsContent value="hashtags" id="hashtags"><HashtagFinder /></TabsContent>
      </Tabs>

      <DynamicAdSlot placement="social-tools-bottom" format="horizontal" className="mt-10" />
    </div>
  );
}
