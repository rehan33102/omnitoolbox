import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import VoiceCloner from "@/components/voice/VoiceCloner";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";

export async function generateMetadata() {
  return buildMetadata({
    title: "Free AI Voice Cloner — Clone Any Voice Online",
    description: "Clone any voice from a 6–30 second sample. Type English text and get real AI voiceovers in your own voice — play, download as MP3. Free, no signup.",
    path: "/ai-voiceover",
    keywords: ["ai voice cloner", "voice cloning", "clone my voice", "voice clone free", "ai voice copy", "clone voice from sample", "custom ai voice", "voiceover with my voice"],
  });
}

export default function AIVoiceoverPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox AI Voice Cloner", description: "Free AI voice cloning — upload a voice sample, generate speech in that voice, download as MP3.", url: serverSiteUrl("/ai-voiceover"), category: "audio" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AI Voice Cloner", path: "/ai-voiceover" }]),
      ]} />
      <TrackUsage slug="ai-voiceover" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="ai">AI Tools</Badge>
          <Badge variant="new">MP3 download</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          AI Voice <span className="text-gradient">Cloner</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          Upload a 6–30 second voice sample, type your text — get it spoken in your voice, free MP3 download.
        </p>
        <Link
          href="/spotlight/voiceover"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-ember-500/40 bg-ember-500/10 px-4 py-2 text-sm font-medium text-ember-700 dark:text-ember-200 hover:bg-ember-500/20 transition"
        >
          <Sparkles size={15} /> View showcase <ArrowRight size={15} />
        </Link>
      </div>

      <div className="relative rounded-2xl overflow-hidden mb-8 border border-black/10 dark:border-white/10 max-w-3xl">
        <Image
          src="/images/voiceover-hero.webp"
          alt="AI voice cloner — clone any voice from a short sample and generate speech online free"
          width={1200}
          height={480}
          className="w-full h-44 md:h-56 object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-transparent to-transparent" />
      </div>

      <div className="max-w-3xl">
        <VoiceCloner />
      </div>

    </div>
  );
}
