import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";
import Image from "next/image";
import JsonLd from "@/components/seo/JsonLd";
import VoiceoverStudio from "@/components/voice/VoiceoverStudio";
import DynamicAdSlot from "@/components/layout/DynamicAdSlot";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";

export const metadata = buildMetadata({
  title: "Free AI Voiceover Studio — Text to Speech Online",
  description: "Turn text into natural voiceovers free with your device's built-in AI voices. Adjust rate, pitch and pick from dozens of voices — no signup, nothing uploaded.",
  path: "/ai-voiceover",
  keywords: ["text to speech", "ai voiceover", "tts free", "voiceover generator", "text to voice online"],
});

export default function AIVoiceoverPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox AI Voiceover Studio", description: "Free client-side text-to-speech voiceover studio.", url: siteUrl("/ai-voiceover"), category: "audio" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AI Voiceover Studio", path: "/ai-voiceover" }]),
      ]} />
      <TrackUsage slug="ai-voiceover" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="ai">AI Tools</Badge>
          <Badge variant="new">100% private</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          AI Voiceover <span className="text-gradient">Studio</span>
        </h1>
        <p className="text-zinc-400 mt-3">
          Free text-to-speech using your device&apos;s built-in AI voices — no signup, nothing uploaded.
        </p>
      </div>

      <div className="relative rounded-2xl overflow-hidden mb-8 border border-white/10 max-w-3xl">
        <Image
          src="/images/voiceover-hero.webp"
          alt="AI voiceover studio — turn text into natural speech online free"
          width={1200}
          height={480}
          className="w-full h-44 md:h-56 object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-transparent to-transparent" />
      </div>

      <div className="max-w-3xl">
        <VoiceoverStudio />
      </div>

      <DynamicAdSlot placement="voiceover-bottom" format="horizontal" className="mt-10" />
    </div>
  );
}
