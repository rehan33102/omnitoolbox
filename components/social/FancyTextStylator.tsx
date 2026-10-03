"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import Card from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { FANCY_STYLES } from "@/data/fancy-text-maps";

export default function FancyTextStylator() {
  const [input, setInput] = useState("Make my bio pop ✨");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { copy } = useCopyToClipboard();

  const copyStyle = async (id: string, text: string) => {
    await copy(text, "Style copied!");
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <Card className="space-y-4">
      <Textarea
        label="Your text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type something…"
      />
      <div className="grid sm:grid-cols-2 gap-3">
        {FANCY_STYLES.map((s) => {
          const out = s.transform(input || "Preview");
          return (
            <div key={s.id} className="glass rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-1">{s.label}</p>
                <p className="truncate text-[15px]">{out}</p>
              </div>
              <button
                onClick={() => copyStyle(s.id, out)}
                aria-label={`Copy ${s.label} style`}
                className="p-2.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/40 border border-brand-500/30 transition shrink-0"
              >
                {copiedId === s.id ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
