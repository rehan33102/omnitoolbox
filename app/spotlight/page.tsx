import Link from "next/link";
import { ArrowRight, Mic2, Sparkles } from "lucide-react";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import SectionHeader from "@/components/home/SectionHeader";
import { Reveal } from "@/hooks/useReveal";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export async function generateMetadata() {
  return buildMetadata({
    title: "Spotlight — Featured Tools & Showcases",
    description:
      "A closer look at the best of OmniToolBox: featured tools and live showcases, starting with the AI Voice Studio.",
    path: "/spotlight",
    keywords: ["spotlight", "featured tools", "ai voice cloner showcase", "free online tools"],
  });
}

const SHOWCASES = [
  {
    icon: Mic2,
    title: "AI Voice Studio",
    text: "Clone any voice from a 6–30 second sample and generate real MP3 voiceovers in that exact voice — free, with consent checks built in.",
    accent: "text-violet-300",
    glow: "from-violet-600/30",
    href: "/spotlight/voiceover",
    cta: "See the showcase",
  },
];

export default function SpotlightPage() {
  return (
    <div className="relative overflow-hidden">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Spotlight", path: "/spotlight" },
          ]),
        ]}
      />

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
          Spotlight
        </p>

        <h1 className="font-condensed uppercase leading-[0.92] tracking-tight text-zinc-900 dark:text-white text-[16vw] sm:text-7xl md:text-8xl lg:text-[7rem] select-none">
          <span className="block overflow-hidden">
            <span className="block animate-hero-line">Worth a</span>
          </span>
          <span className="block overflow-hidden">
            <span className="block animate-hero-line [animation-delay:120ms]">
              <span className="text-gradient-warm">closer look.</span>
            </span>
          </span>
        </h1>

        <p className="mt-6 text-zinc-600 dark:text-zinc-400 text-base md:text-lg max-w-2xl mx-auto animate-fade-up [animation-delay:240ms]">
          Featured tools and live showcases from OmniToolBox — the ones we are
          proudest of, shown in full.
        </p>
      </div>

      <div className="container pb-16">
        <SectionHeader
          eyebrow="Featured showcases"
          title={
            <>In the <span className="text-gradient-warm">spotlight</span></>
          }
          sub="One tool at a time, shown the way it deserves to be shown."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {SHOWCASES.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <Card className="h-full relative overflow-hidden group">
                <div
                  className={`absolute -top-12 left-1/2 -translate-x-1/2 h-28 w-40 rounded-full bg-gradient-to-b ${s.glow} to-transparent blur-[36px] opacity-60 group-hover:opacity-100 transition-opacity`}
                  aria-hidden
                />
                <s.icon size={26} className={`${s.accent} mb-4 relative`} />
                <h3 className="font-display font-bold text-lg mb-2 relative">{s.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed relative">
                  {s.text}
                </p>
                <Link href={s.href} className="inline-block mt-5 relative">
                  <Button size="sm" variant="secondary">
                    {s.cta} <ArrowRight size={15} />
                  </Button>
                </Link>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
