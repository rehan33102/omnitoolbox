import Link from "next/link";
import { ArrowRight, Gauge, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { buildMetadata, websiteJsonLd, faqJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Hero from "@/components/home/Hero";
import ToolExplorer from "@/components/home/ToolExplorer";
import UsageCounter from "@/components/home/UsageCounter";
import SectionHeader from "@/components/home/SectionHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import TrackUsage from "@/components/analytics/TrackUsage";
import { Reveal } from "@/hooks/useReveal";
import { getPublicTools } from "@/lib/get-tools";

export const revalidate = 300;

export const metadata = buildMetadata({
  title: "OmniToolBox — Free AI Tools, Image Utilities & Web Tools",
  description: "50+ free AI & web utilities: AI prompt studio, image converter & compressor, fancy text stylizer, bio generator, hashtag finder. No signup required.",
  path: "/",
  keywords: ["free ai tools", "prompt generator", "image converter", "image compressor", "fancy text", "hashtag generator", "online utilities"],
});

const FAQS = [
  { question: "Is OmniToolBox really free?", answer: "Yes — every tool is 100% free with no signup, no watermarks and no usage caps on core features." },
  { question: "Do my images get uploaded to a server?", answer: "No. Image tools run entirely in your browser via canvas and WebAssembly. Your files never leave your device." },
  { question: "Which AI models does the Prompt Studio support?", answer: "Midjourney, ChatGPT/GPT-4, Flux and Claude — each with tailored syntax, preset styles and negative-prompt builders." },
  { question: "Can I use the tools on mobile?", answer: "Yes. Every tool is fully responsive and touch-friendly on phones, tablets and desktops." },
  { question: "How do I suggest a new tool?", answer: "Use the contact page — popular requests get built first and ship without any downtime." },
];

const FEATURES = [
  { icon: Wallet, title: "100% free, forever", text: "No paywalls, no credits, no watermarks. Every utility is free for everyone." },
  { icon: ShieldCheck, title: "Private by design", text: "Image and media tools process locally in your browser — nothing is uploaded." },
  { icon: Gauge, title: "Zero server lag", text: "Client-side processing and edge-cached pages mean instant results." },
  { icon: Sparkles, title: "Always expanding", text: "New AI tools and utilities ship regularly, voted by the community." },
];

export default async function HomePage() {
  const tools = await getPublicTools();

  return (
    <>
      <JsonLd data={[websiteJsonLd(), faqJsonLd(FAQS)]} />
      <TrackUsage slug="homepage" />

      <Hero toolCount={tools.length} />


      <div className="mt-14 md:mt-20">
        <ToolExplorer tools={tools} />
      </div>

      <div className="mt-14 md:mt-20">
        <UsageCounter toolCount={tools.length} />
      </div>

      <section className="container mt-20 md:mt-28">
        <SectionHeader
          eyebrow="Why OmniToolBox"
          title={<>Built for <span className="text-gradient-warm">creators</span></>}
          sub="One fast, private toolbox that respects your time, your data and your wallet."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90} variant="scale">
              <Card className="h-full glow-card relative group">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-ember-500/20 to-magent-500/15 border border-black/10 dark:border-white/10 mb-4">
                  <f.icon size={20} className="text-ember-300" />
                </span>
                <h3 className="font-display font-semibold mb-1.5 tracking-tight">{f.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>


      <section className="container mt-20 md:mt-28 max-w-3xl">
        <SectionHeader
          eyebrow="Good to know"
          title={<>Questions, <span className="text-gradient-warm">answered</span></>}
        />
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <Reveal key={f.question} delay={Math.min(i * 70, 280)}>
              <Card className="glow-card relative">
                <h3 className="font-display font-semibold mb-1.5 tracking-tight">{f.question}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.answer}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container mt-20 md:mt-28">
        <Reveal variant="scale">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900 p-10 md:p-16 text-center">
            {/* warm glow field */}
            <div className="absolute inset-0 -z-0" aria-hidden>
              <div className="absolute -top-32 left-1/4 h-64 w-64 rounded-full bg-ember-500/25 blur-[110px] animate-glow-drift" />
              <div className="absolute -bottom-32 right-1/4 h-64 w-64 rounded-full bg-magent-500/20 blur-[110px] animate-glow-drift [animation-delay:-5s]" />
            </div>
            <div className="relative">
              <p className="eyebrow justify-center mb-4">One toolbox</p>
              <h2 className="font-condensed uppercase leading-[0.95] tracking-tight text-white text-4xl sm:text-5xl md:text-6xl">
                Stop juggling 20<br />
                <span className="text-gradient-warm">bookmarked tools.</span>
              </h2>
              <p className="text-zinc-400 mt-4 max-w-xl mx-auto">One fast, free toolbox for everything you create, post and ship.</p>
              <Link href="/ai-prompt-studio" className="inline-block mt-8">
                <Button size="lg" className="!bg-gradient-to-r !from-ember-500 !to-magent-500 hover:!shadow-glow-warm !border-0">
                  Start creating free <ArrowRight size={17} />
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

    </>
  );
}
