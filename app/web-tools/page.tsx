import Image from "next/image";
import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import WebToolTabs from "@/components/web/WebToolTabs";
import DynamicAdSlot from "@/components/layout/DynamicAdSlot";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";

export const metadata = buildMetadata({
  title: "Free Web Tools — QR Generator & Password Generator",
  description: "Create custom QR codes (PNG/SVG) and generate cryptographically secure passwords — 100% client-side, private, free. No signup.",
  path: "/web-tools",
  keywords: ["qr code generator", "password generator", "free qr maker", "strong password generator", "secure password", "qr code png download"],
});

export default function WebToolsPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox Web Tools", description: "Free client-side QR generator and password generator.", url: serverSiteUrl("/web-tools"), category: "web" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Web Tools", path: "/web-tools" }]),
      ]} />
      <TrackUsage slug="web-tools" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="web">Web Utilities</Badge>
          <Badge variant="new">100% private</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          Web <span className="text-gradient">Tools</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          Handy everyday utilities that run entirely in your browser.
          Scannable QR codes and unbreakable passwords — zero uploads, zero cost.
        </p>
      </div>

      <div className="relative rounded-2xl overflow-hidden mb-8 border border-black/10 dark:border-white/10">
        <Image
          src="/images/web-tools-hero.webp"
          alt="QR code generator and password generator — free web utilities"
          width={1200}
          height={480}
          className="w-full h-44 md:h-56 object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-transparent to-transparent" />
      </div>

      <WebToolTabs />

      <DynamicAdSlot placement="web-tools-bottom" format="horizontal" className="mt-10" />
    </div>
  );
}
