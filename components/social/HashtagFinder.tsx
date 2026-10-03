"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, Hash } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { HASHTAG_NICHES, HASHTAG_PACKS, type HashtagNiche } from "@/data/hashtag-packs";
import { cn } from "@/lib/utils";
import { saveRecord } from "@/lib/db";

export default function HashtagFinder() {
  const [niche, setNiche] = useState<HashtagNiche>("fitness");
  const [count, setCount] = useState(20);
  const { copy, copied } = useCopyToClipboard();
  const lastSavedRef = useRef("");

  const tags = useMemo(() => {
    const pack = HASHTAG_PACKS[niche];
    // balanced mix: 30% high / 40% mid / 30% low competition
    const take = (arr: string[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
    const h = Math.round(count * 0.3), l = Math.round(count * 0.3), m = count - h - l;
    return [...take(pack.high, h), ...take(pack.mid, m), ...take(pack.low, l)].map((t) => `#${t}`);
  }, [niche, count]);

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
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Niche</p>
        <div className="flex flex-wrap gap-2">
          {HASHTAG_NICHES.map((n) => (
            <button
              key={n}
              onClick={() => setNiche(n)}
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
        {tags.map((t) => (
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
