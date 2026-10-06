import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import Image from "next/image";
import JsonLd from "@/components/seo/JsonLd";
import PdfToolTabs from "@/components/pdf/PdfToolTabs";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";

export async function generateMetadata() {
  return buildMetadata({
    title: "Free PDF Tools — Merge, Split & Images to PDF",
    description: "Merge PDFs, split pages, and convert images to PDF — 100% client-side, private, free. No signup, no uploads.",
    path: "/pdf-tools",
    keywords: ["merge pdf", "split pdf", "images to pdf", "combine pdf online", "extract pdf pages", "jpg to pdf"],
  });
}

export default function PdfToolsPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox PDF Tools", description: "Free client-side PDF utilities.", url: serverSiteUrl("/pdf-tools"), category: "pdf" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "PDF Tools", path: "/pdf-tools" }]),
      ]} />
      <TrackUsage slug="pdf-tools" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="pdf">PDF Utilities</Badge>
          <Badge variant="new">100% private</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          PDF <span className="text-gradient">Tools</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          PDF utilities that run in your browser.
        </p>
      </div>

      <div className="relative rounded-2xl overflow-hidden mb-8 border border-black/10 dark:border-white/10">
        <Image
          src="/images/pdf-tools-hero.webp"
          alt="Merge, split and convert PDF files — free online PDF tools"
          width={1200}
          height={480}
          className="w-full h-44 md:h-56 object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-transparent to-transparent" />
      </div>

      <PdfToolTabs />

    </div>
  );
}
