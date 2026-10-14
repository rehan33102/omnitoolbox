import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import VoiceCloner from "@/components/voice/VoiceCloner";
import TrackUsage from "@/components/analytics/TrackUsage";

export async function generateMetadata() {
  return buildMetadata({
    title: "Free AI Voice Studio — Clone Any Voice & Create AI Voiceovers",
    description: "Pick a ready studio voice or clone your own from a short sample. Type your script, choose a purpose, and download a real AI voiceover MP3 — free, no signup.",
    path: "/ai-voiceover",
    keywords: ["ai voice studio", "ai voice cloner", "voice cloning", "ai voiceover generator", "text to speech voices", "clone my voice", "youtube voiceover", "voice clone free"],
  });
}

export default function AIVoiceoverPage() {
  return (
    <div className="container py-8 md:py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox AI Voice Studio", description: "Free AI voice studio — pick a ready voice or clone your own, generate voiceovers and download MP3.", url: serverSiteUrl("/ai-voiceover"), category: "audio" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AI Voice Studio", path: "/ai-voiceover" }]),
      ]} />
      <TrackUsage slug="ai-voiceover" />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-7">
          <h1 className="font-display text-3xl md:text-[42px] leading-tight font-extrabold tracking-tight">
            AI Voice <span className="text-gradient">Studio</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2.5 text-[15px]">
            Pick a studio voice — or clone your own — and turn any script into a voiceover.
          </p>
        </div>

        <VoiceCloner />
      </div>
    </div>
  );
}
