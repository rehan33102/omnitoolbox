import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import LibraryClient from "@/components/library/LibraryClient";

export async function generateMetadata() {
  return buildMetadata({
    title: "My Library — Everything You Saved",
    description: "Your private on-device library: voiceovers, QR codes, and converted images saved across OmniToolBox tools. Nothing leaves your device.",
    path: "/library",
    keywords: ["my library", "saved files", "voiceover history", "qr history"],
  });
}

export default function LibraryPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "My Library", path: "/library" }])]} />
      <div className="max-w-4xl mb-8">
        <p className="eyebrow mb-4">️ Cloud library — sign in to sync across devices</p>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          My <span className="text-gradient">Library</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          Everything you&rsquo;ve generated across the tools — voiceovers, QR codes,
          converted images. Stored privately in your browser, never uploaded.
        </p>
      </div>
      <div className="max-w-4xl">
        <LibraryClient />
      </div>
    </div>
  );
}
