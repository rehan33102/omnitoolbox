"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";

const VIBES = ["Professional", "Bold", "Funny", "Minimal"] as const;
const NICHES = ["Creator", "Fitness", "Finance", "Travel", "Food", "Fashion", "Tech", "Photography"] as const;

function buildBios(name: string, niche: string, vibe: string): string[] {
  const n = name.trim() || "yourname";
  const templates: Record<string, string[]> = {
    Professional: [
      `👋 ${n} | ${niche}\n📈 Helping you grow, one post at a time\n👇 Work with me`,
      `${niche} strategist 🚀\n✨ Daily tips that actually work\n📩 DM "START" to connect`,
      `Hi, I'm ${n} 👋\n${niche} expert | Speaker | Creator\n🔗 Latest below`,
    ],
    Bold: [
      `⚡ ${n} — ${niche} with NO filter\n🔥 I say what others won't\n👇 Join the rebellion`,
      `STOP scrolling 🛑\n${n} turns ${niche.toLowerCase()} chaos into clarity\n💥 New heat daily`,
      `${n} | ${niche} disruptor\n🎯 Results > excuses\n👇 Prove me wrong`,
    ],
    Funny: [
      `Professional overthinker 🧠\nPart-time ${niche.toLowerCase()} enthusiast, full-time snacker 🍕\n— ${n}`,
      `${n} here 👋\nI do ${niche.toLowerCase()} so you don't have to\n⚠️ Side effects: laughter`,
      `Certified ${niche.toLowerCase()} nerd 🤓\nRunning on coffee & chaos ☕\n👇 Come for the memes`,
    ],
    Minimal: [
      `${n}\n${niche}\n👇`,
      `— ${n} · ${niche.toLowerCase()} —\nless, but better`,
      `${niche} · est. 2026\n${n}`,
    ],
  };
  return templates[vibe] ?? templates.Professional;
}

export default function BioGenerator() {
  const [name, setName] = useState("");
  const [niche, setNiche] = useState<(typeof NICHES)[number]>("Creator");
  const [vibe, setVibe] = useState<(typeof VIBES)[number]>("Bold");
  const [bios, setBios] = useState<string[]>(() => buildBios("", "Creator", "Bold"));
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const { copy } = useCopyToClipboard();

  const generate = () => {
    setBios(buildBios(name, niche, vibe));
    setCopiedIdx(null);
  };

  const copyBio = async (bio: string, i: number) => {
    await copy(bio, "Bio copied!");
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <Card className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <Input label="Name / handle" placeholder="yourname" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Niche</label>
          <select value={niche} onChange={(e) => setNiche(e.target.value as (typeof NICHES)[number])} className="input-base">
            {NICHES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Vibe</label>
          <select value={vibe} onChange={(e) => setVibe(e.target.value as (typeof VIBES)[number])} className="input-base">
            {VIBES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>

      <Button onClick={generate}><Sparkles size={15} /> Generate bios</Button>

      <div className="grid md:grid-cols-3 gap-3">
        {bios.map((bio, i) => (
          <div key={i} className={cn("glass rounded-xl p-4 flex flex-col", copiedIdx === i && "ring-2 ring-emerald-500/50")}>
            <pre className="whitespace-pre-wrap font-sans text-sm flex-1">{bio}</pre>
            <div className="flex items-center justify-between mt-3">
              <span className={cn("text-xs", bio.length > 150 ? "text-red-600 dark:text-red-400" : "text-zinc-500")}>
                {bio.length}/150
              </span>
              <button
                onClick={() => copyBio(bio, i)}
                className="p-2 rounded-lg bg-brand-600/20 hover:bg-brand-600/40 border border-brand-500/30 transition"
                aria-label="Copy bio"
              >
                {copiedIdx === i ? <Check size={14} className="text-emerald-700 dark:text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
