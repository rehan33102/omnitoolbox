import Link from "next/link";
import { ArrowRight, Smartphone, Sparkles, Zap } from "lucide-react";
import Button from "@/components/ui/Button";

const MARQUEE_ITEMS = [
  "AI Prompt Studio",
  "Image Converter",
  "Background Remover",
  "AI Voiceover",
  "QR Generator",
  "PDF Merger",
  "Fancy Text",
  "Hashtag Finder",
  "Unit Converter",
  "BMI Calculator",
];

export default function Hero({ toolCount }: { toolCount: number }) {
  return (
    <section className="relative overflow-hidden">
      {/* Warm premium glow field — GPU-friendly blurred radial blobs */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-ink-950 dark:bg-ink-950" />
        <div className="absolute -top-48 left-[8%] h-[420px] w-[420px] rounded-full bg-ember-500/25 blur-[130px] animate-glow-drift" />
        <div className="absolute -top-24 right-[4%] h-[380px] w-[380px] rounded-full bg-magent-500/20 blur-[130px] animate-glow-drift [animation-delay:-4s]" />
        <div className="absolute top-40 left-1/2 -translate-x-1/2 h-[300px] w-[700px] rounded-full bg-brand-600/15 blur-[140px]" />
        {/* faint grid texture */}
        <div
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 20%, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 20%, black 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="container pt-14 pb-10 md:pt-24 md:pb-14 text-center relative">
        {/* Magazine eyebrow */}
        <p className="eyebrow justify-center mb-6 animate-fade-up">
          <Sparkles size={12} className="text-ember-400" />
          {toolCount}+ free tools · no signup · no watermarks
        </p>

        {/* Giant condensed editorial headline */}
        <h1 className="font-condensed uppercase leading-[0.92] tracking-tight text-white text-[17vw] sm:text-7xl md:text-8xl lg:text-[7.5rem] select-none">
          <span className="block overflow-hidden">
            <span className="block animate-hero-line">Every tool</span>
          </span>
          <span className="block overflow-hidden">
            <span className="block animate-hero-line [animation-delay:120ms]">
              you need<span className="text-ember-500">.</span>
            </span>
          </span>
          <span className="block overflow-hidden">
            <span className="block animate-hero-line [animation-delay:240ms]">
              <span className="text-gradient-warm">One toolbox.</span>
            </span>
          </span>
        </h1>

        <p
          className="mt-6 text-zinc-400 text-base md:text-lg max-w-2xl mx-auto animate-fade-up [animation-delay:360ms]"
        >
          Prompt Studio, image converter &amp; compressor, AI voiceover, fancy
          text, bio generator, hashtag finder and more — private,
          and 100% free.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3 animate-fade-up [animation-delay:480ms]">
          <Link href="#tools">
            <Button size="lg" className="!bg-gradient-to-r !from-ember-500 !to-magent-500 hover:!shadow-glow-warm !border-0">
              <Zap size={17} /> Explore tools <ArrowRight size={17} />
            </Button>
          </Link>
          <a href="/downloads/omnibox-app.apk" download>
            <Button size="lg" variant="secondary"><Smartphone size={17} /> Download App</Button>
          </a>
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.2em] text-zinc-500 animate-fade-up [animation-delay:600ms]">
          <span>100% free forever</span>
          <span className="text-zinc-700">/</span>
          <span>Private by design</span>
          <span className="text-zinc-700">/</span>
          <span>Works on mobile</span>
        </div>
      </div>

      {/* Premium marquee strip */}
      <div className="relative border-y border-white/10 bg-black/40 py-3.5 overflow-hidden" aria-hidden>
        <div className="marquee-track gap-10 text-sm font-display font-semibold uppercase tracking-[0.25em] text-zinc-500">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap">
              <span className="hover:text-ember-400 transition-colors">{item}</span>
              <span className="text-ember-500/60">✦</span>
            </span>
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink-950 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink-950 to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
