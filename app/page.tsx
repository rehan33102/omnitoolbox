import Link from "next/link";
import { ArrowRight, Gauge, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { buildMetadata, websiteJsonLd, faqJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Hero from "@/components/home/Hero";
import ToolExplorer from "@/components/home/ToolExplorer";
import UsageCounter from "@/components/home/UsageCounter";
import DynamicAdSlot from "@/components/layout/DynamicAdSlot";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import TrackUsage from "@/components/analytics/TrackUsage";
import { getPublicTools } from "@/lib/get-tools";

export const revalidate = 300;

export const metadata = buildMetadata({
  title: "OmniToolBox — Free AI Tools, Image Utilities & Web Tools",
  description: "50+ free AI & web utilities: AI prompt studio, image converter & compressor, fancy text stylizer, bio generator, hashtag finder. No signup, no lag.",
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

      <DynamicAdSlot placement="homepage-top" format="horizontal" className="container mt-4" />

      <div className="mt-14">
        <ToolExplorer tools={tools} />
      </div>

      <div className="mt-14">
        <UsageCounter toolCount={tools.length} />
      </div>

      <section className="container mt-20">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-10">Why creators pick OmniToolBox</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <Card key={f.title} hover>
              <f.icon size={22} className="text-brand-400 mb-3" />
              <h3 className="font-display font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-zinc-400">{f.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <DynamicAdSlot placement="homepage-mid" format="horizontal" className="container mt-16" />

      <section className="container mt-20 max-w-3xl">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-8">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <Card key={f.question}>
              <h3 className="font-display font-semibold mb-1.5">{f.question}</h3>
              <p className="text-sm text-zinc-400">{f.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mt-20">
        <div className="relative overflow-hidden rounded-3xl glass p-10 md:p-14 text-center">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[500px] rounded-full bg-brand-600/25 blur-[100px] -z-0" />
          <div className="relative">
            <h2 className="font-display text-2xl md:text-4xl font-bold">Stop juggling 20 bookmarked tools.</h2>
            <p className="text-zinc-400 mt-3 max-w-xl mx-auto">One fast, free toolbox for everything you create, post and ship.</p>
            <Link href="/ai-prompt-studio" className="inline-block mt-7">
              <Button size="lg">Start creating free <ArrowRight size={17} /></Button>
            </Link>
          </div>
        </div>
      </section>

      <DynamicAdSlot placement="homepage-bottom" format="horizontal" className="container mt-14" />
    </>
  );
}
