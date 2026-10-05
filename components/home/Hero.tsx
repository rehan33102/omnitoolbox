import Link from "next/link";
import { ArrowRight, Sparkles, Zap, ShieldCheck, Smartphone, Infinity as InfinityIcon } from "lucide-react";
import Button from "@/components/ui/Button";
import DownloadAppButton from "./DownloadAppButton";

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
        <div className="absolute -top-48 left-[8%] h-[420px] w-[420px] rounded-full bg-ember-500/25 blur-[80px] animate-glow-drift will-change-transform" />
        <div className="absolute -top-24 right-[4%] h-[380px] w-[380px] rounded-full bg-magent-500/20 blur-[80px] animate-glow-drift [animation-delay:-4s] will-change-transform" />
        <div className="absolute top-40 left-1/2 -translate-x-1/2 h-[300px] w-[700px] rounded-full bg-brand-600/15 blur-[90px]" />
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
          <DownloadAppButton />
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.2em] text-zinc-500 animate-fade-up [animation-delay:600ms]">
          <span>100% free forever</span>
          <span className="text-zinc-700">/</span>
          <span>Private by design</span>
          <span className="text-zinc-700">/</span>
          <span>Works on mobile</span>
        </div>

        {/* Glassmorphic floating stat cards */}
        <div className="mt-10 flex flex-wrap justify-center gap-4 animate-fade-up [animation-delay:720ms]">
          <div className="glass-card glass-float glass-shimmer px-6 py-4 flex items-center gap-3" style={{ "--anim-delay": "0s" } as React.CSSProperties}>
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg">
              <Zap size={18} />
            </span>
            <div className="text-left">
              <p className="font-display font-bold text-xl text-white leading-none">{toolCount}+</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-400 mt-1">Free tools</p>
            </div>
          </div>
          <div className="glass-card glass-float glass-shimmer px-6 py-4 flex items-center gap-3" style={{ "--anim-delay": "1.2s" } as React.CSSProperties}>
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
              <ShieldCheck size={18} />
            </span>
            <div className="text-left">
              <p className="font-display font-bold text-xl text-white leading-none">100%</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-400 mt-1">Private</p>
            </div>
          </div>
          <div className="glass-card glass-float glass-shimmer px-6 py-4 flex items-center gap-3" style={{ "--anim-delay": "2.4s" } as React.CSSProperties}>
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-lg">
              <Smartphone size={18} />
            </span>
            <div className="text-left">
              <p className="font-display font-bold text-xl text-white leading-none">24/7</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-400 mt-1">Mobile ready</p>
            </div>
          </div>
          <div className="glass-card glass-float glass-shimmer px-6 py-4 flex items-center gap-3" style={{ "--anim-delay": "3.6s" } as React.CSSProperties}>
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg">
              <InfinityIcon size={18} />
            </span>
            <div className="text-left">
              <p className="font-display font-bold text-xl text-white leading-none">$0</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-400 mt-1">Forever free</p>
            </div>
          </div>
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
