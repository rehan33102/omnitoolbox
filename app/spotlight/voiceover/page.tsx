import Link from "next/link";
import { ArrowRight, Download, LibraryBig, Mic2, Sparkles } from "lucide-react";
import { buildMetadata, breadcrumbJsonLd, serverSiteUrl, softwareAppJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import VoiceCloner from "@/components/voice/VoiceCloner";
import SectionHeader from "@/components/home/SectionHeader";
import { Reveal } from "@/hooks/useReveal";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export async function generateMetadata() {
  return buildMetadata({
    title: "AI Voice Studio — Clone & Create Voices Free",
    description: "See the OmniToolBox AI Voice Studio in action: clone any voice from a 6–30 second sample and generate real MP3 voiceovers in that voice — free.",
    path: "/spotlight/voiceover",
    keywords: ["ai voice cloner", "voice cloning showcase", "clone my voice", "free voice clone", "ai voice copy"],
  });
}

const FEATURES = [
  {
    icon: Mic2,
    title: "Your voice, cloned",
    text: "Upload a 6–30 second sample of any single voice — yours, a character, a narrator — and the clone engine speaks in that exact voice.",
    accent: "text-violet-300",
    glow: "from-violet-600/30",
  },
  {
    icon: Download,
    title: "Real MP3 downloads",
    text: "Every generation gives you a real MP3 you can play, download and use anywhere — plus consent checks so nothing is faked.",
    accent: "text-cyan-300",
    glow: "from-cyan-600/30",
  },
  {
    icon: LibraryBig,
    title: "Private on-device library",
    text: "Everything you create is saved to your private My Library, stored in your browser — never uploaded, never tracked.",
    accent: "text-amber-700 dark:text-amber-300",
    glow: "from-amber-600/30",
  },
];

export default function VoiceoverSpotlightPage() {
  return (
    <div className="relative overflow-hidden">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox AI Voice Studio", description: "Free AI voice cloning — upload a voice sample, generate speech in that voice, download as MP3.", url: serverSiteUrl("/spotlight/voiceover"), category: "audio" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AI Voice Cloner", path: "/ai-voiceover" }, { name: "Showcase", path: "/spotlight/voiceover" }]),
      ]} />

      {/* Premium glow field — ember → magenta → purple */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-ink-950" />
        <div className="absolute -top-40 left-[5%] h-[440px] w-[440px] rounded-full bg-ember-500/25 blur-[80px] animate-glow-drift will-change-transform" />
        <div className="absolute -top-24 right-[2%] h-[400px] w-[400px] rounded-full bg-magent-500/25 blur-[80px] animate-glow-drift will-change-transform [animation-delay:-4s]" />
        <div className="absolute top-64 left-1/2 -translate-x-1/2 h-[320px] w-[720px] rounded-full bg-purple-600/20 blur-[90px]" />
      </div>

      <div className="container pt-14 pb-10 md:pt-20 md:pb-14 text-center">
        <p className="eyebrow justify-center mb-6 animate-fade-up">
          <Sparkles size={12} className="text-ember-600 dark:text-ember-400" />
          Spotlight · Voice Cloner
        </p>

        <h1 className="font-condensed uppercase leading-[0.92] tracking-tight text-zinc-900 dark:text-white text-[16vw] sm:text-7xl md:text-8xl lg:text-[7rem] select-none">
          <span className="block overflow-hidden">
            <span className="block animate-hero-line">Voice</span>
          </span>
          <span className="block overflow-hidden">
            <span className="block animate-hero-line [animation-delay:120ms]">
              <span className="text-gradient-warm">Cloner.</span>
            </span>
          </span>
        </h1>

        <p className="mt-6 text-zinc-600 dark:text-zinc-400 text-base md:text-lg max-w-2xl mx-auto animate-fade-up [animation-delay:240ms]">
          Upload a voice sample. Type your script. Get studio-quality narration in that exact voice —
          free, private, and yours to keep.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3 animate-fade-up [animation-delay:360ms]">
          <a href="#try-it">
            <Button size="lg" className="!bg-gradient-to-r !from-ember-500 !to-magent-500 hover:!shadow-glow-warm !border-0">
              Try it live <ArrowRight size={17} />
            </Button>
          </a>
          <Link href="/library">
            <Button size="lg" variant="secondary"><LibraryBig size={17} /> My Library</Button>
          </Link>
        </div>
      </div>

      <div className="container pb-6">
        <SectionHeader
          eyebrow="Why it hits different"
          title={<>Built for creators, <span className="text-gradient-warm">not robots</span></>}
          sub="Your own voice, on demand — downloads that work everywhere, and a library that respects your privacy."
        />
        <div className="grid sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <Card className="h-full relative overflow-hidden group">
                <div className={`absolute -top-12 left-1/2 -translate-x-1/2 h-28 w-40 rounded-full bg-gradient-to-b ${f.glow} to-transparent blur-[36px] opacity-60 group-hover:opacity-100 transition-opacity`} aria-hidden />
                <f.icon size={26} className={`${f.accent} mb-4 relative`} />
                <h3 className="font-display font-bold text-lg mb-2 relative">{f.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed relative">{f.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>

      <div id="try-it" className="container py-10 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            eyebrow="Live demo"
            title="Clone your first voice"
            sub="The real cloner, right here — everything you generate is saved to your library automatically."
          />
          <VoiceCloner />
        </div>
      </div>

      <div className="container pb-16">
        <Reveal className="max-w-3xl mx-auto">
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-gradient-to-br from-ember-600/20 via-magent-600/15 to-purple-600/20 p-8 md:p-10 text-center relative overflow-hidden">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-magent-500/25 blur-[80px]" aria-hidden />
            <h2 className="font-condensed uppercase text-3xl md:text-5xl tracking-tight relative">
              Your creations live in <span className="text-gradient-warm">your library</span>
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-3 max-w-xl mx-auto relative">
              Every cloned voiceover, QR code and converted image is saved on your device.
              Play them back, download them again, delete them — anytime.
            </p>
            <Link href="/library" className="inline-block mt-6 relative">
              <Button size="lg" className="!bg-gradient-to-r !from-ember-500 !to-magent-500 hover:!shadow-glow-warm !border-0">
                <LibraryBig size={17} /> Open My Library <ArrowRight size={17} />
              </Button>
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
