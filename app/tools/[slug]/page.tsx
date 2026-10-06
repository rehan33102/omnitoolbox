import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TOOLS, getToolBySlug } from "@/lib/tools-registry";
import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd, serverSiteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";
import { getListings } from "@/lib/get-directory";

/**
 * Every tool gets its own clean slug URL: /tools/<slug>
 * (e.g. /tools/background-remover). Tool cards link here.
 * Old hub pages (/media-tools, /pdf-tools, /social-tools, /calculators)
 * keep working as category overviews.
 */

const TOOL_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "ai-prompt-studio": dynamic(() => import("@/components/prompt-studio/PromptBuilder")),
  "image-converter": dynamic(() => import("@/components/media/ImageConverter")),
  "image-compressor": dynamic(() => import("@/components/media/ImageCompressor")),
  "svg-cleaner": dynamic(() => import("@/components/media/SvgCleaner")),
  "background-studio": dynamic(() => import("@/components/media/BackgroundStudio")),
  "watermark-remover": dynamic(() => import("@/components/media/WatermarkRemover")),
  "fancy-text": dynamic(() => import("@/components/social/FancyTextStylator")),
  "bio-generator": dynamic(() => import("@/components/social/BioGenerator")),
  "hashtag-finder": dynamic(() => import("@/components/social/HashtagFinder")),
  "ai-directory": dynamic(() => import("@/components/directory/DirectoryExplorer")),
  "ai-voiceover": dynamic(() => import("@/components/voice/VoiceoverStudio")),
  "pdf-merge": dynamic(() => import("@/components/pdf/PdfMerger")),
  "pdf-split": dynamic(() => import("@/components/pdf/PdfSplitter")),
  "images-to-pdf": dynamic(() => import("@/components/pdf/ImagesToPdf")),
  "qr-generator": dynamic(() => import("@/components/web/QrGenerator")),
  "password-generator": dynamic(() => import("@/components/web/PasswordGenerator")),
  "currency-converter": dynamic(() => import("@/components/calc/CurrencyConverter")),
  "unit-converter": dynamic(() => import("@/components/calc/UnitConverter")),
  "bmi-calorie-calculator": dynamic(() => import("@/components/calc/BmiCalculator")),
  "age-calculator": dynamic(() => import("@/components/calc/AgeCalculator")),
};

export async function generateStaticParams() {
  return TOOLS.filter((t) => t.enabled).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const tool = getToolBySlug(params.slug);
  if (!tool) return {};
  return await buildMetadata({
    title: `${tool.title} — ${tool.tagline}`,
    description: tool.description,
    path: `/tools/${tool.slug}`,
    keywords: tool.keywords.slice(0, 12),
    image: tool.image,
  });
}

export default async function ToolPage({ params }: { params: { slug: string } }) {
  const tool = getToolBySlug(params.slug);
  if (!tool || !tool.enabled) notFound();

  const ToolComponent = TOOL_COMPONENTS[tool.slug];
  if (!ToolComponent) notFound();

  // AI directory needs its listings passed in
  const extraProps: Record<string, unknown> =
    tool.slug === "ai-directory" ? { tools: await getListings() } : {};

  return (
    <div className="container py-10">
      <JsonLd
        data={[
          softwareAppJsonLd({
            name: `OmniToolBox ${tool.title}`,
            description: tool.description,
            url: serverSiteUrl(`/tools/${tool.slug}`),
            category: tool.category,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/#tools" },
            { name: tool.title, path: `/tools/${tool.slug}` },
          ]),
        ]}
      />
      <TrackUsage slug={tool.slug} />

      <Link
        href="/#tools"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> All tools
      </Link>

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant={tool.category as any}>{tool.category}</Badge>
          {tool.badge && <Badge variant="new">{tool.badge}</Badge>}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          {tool.title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">{tool.tagline}</p>
      </div>

      <ToolComponent {...extraProps} />

    </div>
  );
}
