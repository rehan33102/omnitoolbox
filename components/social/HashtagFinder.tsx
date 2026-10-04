"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, Hash, Search, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { HASHTAG_NICHES, HASHTAG_PACKS, type HashtagNiche } from "@/data/hashtag-packs";
import { cn } from "@/lib/utils";
import { saveRecord } from "@/lib/db";

/** Generate hashtags for any custom topic the user types. */
function customHashtags(topic: string, count: number): string[] {
  const clean = topic.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
  if (!clean) return [];
  const words = clean.split(" ").filter(Boolean);
  const base = words.join("");
  const tags = new Set<string>();
  // Core variations
  tags.add(base);
  words.forEach((w) => { if (w.length > 2) tags.add(w); });
  tags.add(`${base}love`);
  tags.add(`${base}life`);
  tags.add(`${base}daily`);
  tags.add(`${base}tips`);
  tags.add(`love${base}`);
  tags.add(`insta${base}`);
  tags.add(`${base}2026`);
  tags.add(`${base}community`);
  tags.add(`${base}goals`);
  tags.add(`daily${base}`);
  // Two-word combos
  for (let i = 0; i < words.length - 1; i++) {
    tags.add(words[i] + words[i + 1]);
  }
  // Generic boosters
  ["viral", "trending", "explore", "reels", "instagood", "photooftheday", "likeforlike", "followme", "contentcreator", "socialmedia"].forEach((g) => tags.add(`${base}${g}`));
  const list = [...tags].filter((t) => t.length >= 3 && t.length <= 30);
  // Shuffle and take count
  return list.sort(() => Math.random() - 0.5).slice(0, count).map((t) => `#${t}`);
}

export default function HashtagFinder() {
  const [niche, setNiche] = useState<HashtagNiche | "custom">("fitness");
  const [customTopic, setCustomTopic] = useState("");
  const [count, setCount] = useState(20);
  const { copy, copied } = useCopyToClipboard();
  const lastSavedRef = useRef("");

  const tags = useMemo(() => {
    if (niche === "custom") {
      return customHashtags(customTopic, count);
    }
    const pack = HASHTAG_PACKS[niche as HashtagNiche];
    // balanced mix: 30% high / 40% mid / 30% low competition
    const take = (arr: string[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
    const h = Math.round(count * 0.3), l = Math.round(count * 0.3), m = count - h - l;
    return [...take(pack.high, h), ...take(pack.mid, m), ...take(pack.low, l)].map((t) => `#${t}`);
  }, [niche, customTopic, count]);

  const copyAll = async () => {
    await copy(tags.join(" "), "All hashtags copied!");
    // Persist so the output survives refresh — best-effort, never blocks UX.
    // Dedup: don't store an identical set twice in a row.
    const key = `${niche}:${tags.join(" ")}`;
    if (lastSavedRef.current !== key) {
      lastSavedRef.current = key;
      try {
        void saveRecord("text", { niche, hashtags: tags, createdAt: Date.now() });
      } catch {
        /* library save is non-critical */
      }
    }
  };

  return (
    <Card className="space-y-5">
      {/* Custom search — type any topic */}
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">🔍 Search your own topic</p>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={customTopic}
            onChange={(e) => { setCustomTopic(e.target.value); if (e.target.value.trim()) setNiche("custom"); }}
            placeholder="Type anything… e.g. cricket, cooking, makeup"
            className="w-full rounded-xl border border-white/10 bg-black/5 dark:bg-white/5 pl-10 pr-10 py-3 text-sm outline-none focus:border-violet-500/60 placeholder:text-zinc-500"
          />
          {customTopic && (
            <button onClick={() => { setCustomTopic(""); setNiche("fitness"); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Or pick a niche</p>
        <div className="flex flex-wrap gap-2">
          {HASHTAG_NICHES.map((n) => (
            <button
              key={n}
              onClick={() => { setNiche(n); setCustomTopic(""); }}
              className={cn("btn-base px-3.5 py-1.5 text-xs rounded-full border capitalize",
                niche === n ? "bg-brand-600/25 border-brand-500/50 text-zinc-900 dark:text-white" : "glass text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Hashtag count: {count}</p>
        <input type="range" min={5} max={30} value={count}
          onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-violet-500" />
      </div>

      <div className="flex flex-wrap gap-2">
        {niche === "custom" && !customTopic.trim() ? (
          <p className="text-sm text-zinc-500 py-4">👆 Type your topic above to generate hashtags!</p>
        ) : tags.map((t) => (
          <button
            key={t}
            onClick={() => copy(t, `${t} copied`)}
            className="glass rounded-full px-3 py-1.5 text-sm text-accent-600 dark:text-accent-300 hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-1"
          >
            <Hash size={12} />{t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="image">{tags.length} hashtags · balanced reach</Badge>
        <Button size="sm" onClick={copyAll}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy all"}
        </Button>
      </div>
    </Card>
  );
}
