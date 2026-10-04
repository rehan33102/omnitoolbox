import { buildMetadata } from "@/lib/seo";
import Card from "@/components/ui/Card";
import { PlayCircle, Mic, Image, QrCode, FileText, Sparkles } from "lucide-react";

export const metadata = buildMetadata({
  title: "Tutorials — Learn How to Use Omni Tool Box",
  description: "Step-by-step video tutorials showing how to use every Omni Tool Box tool — AI Voiceover, Background Remover, QR Generator and more.",
  path: "/tutorial",
  keywords: ["tutorial", "how to use", "video guide", "omnitoolbox tutorial"],
});

const TUTORIALS = [
  {
    title: "Complete Website Tutorial",
    desc: "Full walkthrough — AI Voiceover live demo, Background Remover live demo, QR tools, PDF tools and more. English + Urdu!",
    duration: "67 sec",
    video: "/tutorials/omnitoolbox-tutorial-v2.mp4",
    poster: "/images/tools/ai-voiceover.jpg",
    icon: PlayCircle,
  },
  {
    title: "AI Voiceover Studio — Full Guide",
    desc: "Type text, pick from 32 languages, choose male/female voice, adjust speed & style, generate and download MP3. 100% free!",
    duration: "Coming soon",
    video: "",
    poster: "/images/tools/ai-voiceover.jpg",
    icon: Mic,
  },
  {
    title: "Background Remover — Full Guide",
    desc: "Upload any photo, one click removes the background. Then use Background Studio to add new backgrounds, shadows and effects!",
    duration: "Coming soon",
    video: "",
    poster: "/images/tools/background-remover.jpg",
    icon: Image,
  },
  {
    title: "QR Generator & More Tools",
    desc: "Create custom QR codes, convert images, merge PDFs, generate fancy text and hashtags — all in seconds!",
    duration: "Coming soon",
    video: "",
    poster: "/images/tools/qr-generator.jpg",
    icon: QrCode,
  },
];

export default function TutorialPage() {
  return (
    <div className="container py-10 max-w-5xl">
      <div className="text-center mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember-600 dark:text-ember-400 mb-3">
          Learn step by step
        </p>
        <h1 className="font-display text-3xl md:text-5xl font-bold mb-4">
          Video <span className="text-gradient-warm">Tutorials</span>
        </h1>
        <p className="text-zinc-500 max-w-2xl mx-auto">
          Watch how to use every tool on Omni Tool Box. Short, clear, and practical —
          made for beginners!
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {TUTORIALS.map((t) => (
          <Card key={t.title} className="overflow-hidden">
            {t.video ? (
              <video
                controls
                preload="metadata"
                className="w-full aspect-video bg-black rounded-xl mb-4"
                src={t.video}
              />
            ) : (
              <div className="w-full aspect-video rounded-xl mb-4 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-white/10 grid place-items-center">
                <t.icon size={48} className="text-violet-400" />
              </div>
            )}
            <div className="flex items-start gap-3">
              <span className="grid place-items-center size-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shrink-0">
                <t.icon size={18} />
              </span>
              <div>
                <h3 className="font-bold text-lg">{t.title}</h3>
                <p className="text-sm text-zinc-500 mt-1">{t.desc}</p>
                <p className="text-xs text-ember-600 dark:text-ember-400 font-semibold mt-2">
                  ⏱ {t.duration}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-10 text-center">
        <Sparkles size={24} className="mx-auto mb-3 text-ember-500" />
        <h2 className="font-bold text-xl mb-2">Want a tutorial for a specific tool?</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Message us on WhatsApp and we'll make one for you!
        </p>
        <a
          href="https://wa.me/923407560964?text=Assalam%20o%20alaikum!%20Please%20make%20a%20tutorial%20for%20..."
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#25D366] text-white font-bold hover:brightness-110 transition"
        >
          Request Tutorial on WhatsApp
        </a>
      </Card>
    </div>
  );
}
