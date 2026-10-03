import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import MediaToolTabs from "@/components/media/MediaToolTabs";
import DynamicAdSlot from "@/components/layout/DynamicAdSlot";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";

export const metadata = buildMetadata({
  title: "Free Image Tools — Converter, Compressor, SVG Cleaner & Background Remover",
  description: "Convert WebP to PNG/JPG, compress images 90%, clean SVGs and remove backgrounds — 100% client-side, private, free. No signup.",
  path: "/media-tools",
  keywords: ["webp to png", "image converter", "image compressor", "svg cleaner", "background remover", "compress jpg online"],
});

export default function MediaToolsPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox Media Tools", description: "Free client-side image utilities.", url: serverSiteUrl("/media-tools"), category: "image" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Media Tools", path: "/media-tools" }]),
      ]} />
      <TrackUsage slug="media-tools" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="image">Image Utilities</Badge>
          <Badge variant="new">100% private</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          Media <span className="text-gradient">Tools</span>
        </h1>
        <p className="text-zinc-400 mt-3">
          Professional image utilities that run entirely in your browser.
          Zero uploads, zero lag, zero cost.
        </p>
      </div>

      <MediaToolTabs />

      <DynamicAdSlot placement="media-tools-bottom" format="horizontal" className="mt-10" />
    </div>
  );
}
