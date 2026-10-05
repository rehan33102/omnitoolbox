"use client";

import Card from "@/components/ui/Card";
import { Wrench, Video, Globe, Mic, Image, MessageCircle, Sparkles, Code, Palette } from "lucide-react";

const WHATSAPP = "923407560964";

const SERVICES = [
  {
    icon: Wrench,
    title: "Custom Tool Development",
    desc: "Need a custom web tool for your business? Calculators, converters, generators — I build fast, modern tools like the ones on this site.",
    msg: "Assalam o alaikum! I'm interested in Custom Tool Development. Please share details and pricing.",
  },
  {
    icon: Video,
    title: "Faceless YouTube Videos",
    desc: "Complete faceless video production — script, AI voiceover, editing, thumbnail. German/English/Urdu. Ready to upload!",
    msg: "Assalam o alaikum! I'm interested in Faceless YouTube Video production. Please share details and pricing.",
  },
  {
    icon: Globe,
    title: "Website Development",
    desc: "Modern, fast websites like this one — Next.js, mobile-friendly, SEO optimized. From landing pages to full web apps.",
    msg: "Assalam o alaikum! I'm interested in Website Development. Please share details and pricing.",
  },
  {
    icon: Mic,
    title: "AI Voiceover Service",
    desc: "Professional AI voiceovers in 32+ languages for your videos, ads, and content. Natural, human-like quality.",
    msg: "Assalam o alaikum! I'm interested in AI Voiceover Service. Please share details and pricing.",
  },
  {
    icon: Image,
    title: "Thumbnail & Graphics Design",
    desc: "Click-worthy YouTube thumbnails, social media graphics, and promotional images that grab attention.",
    msg: "Assalam o alaikum! I'm interested in Thumbnail & Graphics Design. Please share details and pricing.",
  },
  {
    icon: Code,
    title: "Android App Development",
    desc: "Turn your website into an Android app, or build a custom app from scratch. Play Store ready!",
    msg: "Assalam o alaikum! I'm interested in Android App Development. Please share details and pricing.",
  },
];

function waLink(msg: string) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

export default function HireMePage() {
  return (
    <div className="container py-10 max-w-5xl">
      <div className="text-center mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember-600 dark:text-ember-400 mb-3">
          Work with me
        </p>
        <h1 className="font-display text-3xl md:text-5xl font-bold mb-4">
          Hire <span className="text-gradient-warm">Me</span>
        </h1>
        <p className="text-zinc-500 max-w-2xl mx-auto">
          Pick a service below — you'll land on WhatsApp with a ready message.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SERVICES.map((s) => (
          <Card key={s.title} className="flex flex-col">
            <span className="grid place-items-center size-12 rounded-2xl bg-gradient-to-br from-ember-500 to-magent-500 text-white mb-4">
              <s.icon size={22} />
            </span>
            <h3 className="font-bold text-lg mb-2">{s.title}</h3>
            <p className="text-sm text-zinc-500 flex-1 mb-4">{s.desc}</p>
            <a
              href={waLink(s.msg)}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <MessageCircle size={16} /> Ask on WhatsApp
            </a>
          </Card>
        ))}
      </div>

      <Card className="mt-10 text-center">
        <Sparkles size={24} className="mx-auto mb-3 text-ember-500" />
        <h2 className="font-bold text-xl mb-2">Something else in mind?</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Tell me what you need.
        </p>
        <a
          href={waLink("Assalam o alaikum! I have a custom project in mind. Can we discuss?")}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-ember-500 to-magent-500 text-white font-bold hover:shadow-glow-warm transition"
        >
          <MessageCircle size={16} /> Custom Project
        </a>
      </Card>

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-500">
        <Palette size={14} />
        <span>Developed by <strong className="text-zinc-700 dark:text-zinc-300">Rehan</strong> — fast delivery, fair prices!</span>
      </div>
    </div>
  );
}
