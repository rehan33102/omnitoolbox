"use client";

import { useEffect, useState } from "react";
import { Check, ChevronUp } from "lucide-react";
import { getViewerId } from "@/hooks/useTrackToolUsage";
import { cn } from "@/lib/utils";

export default function VoteButtons({ slug, initialVotes, compact = false }: { slug: string; initialVotes: number; compact?: boolean }) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(`otb-vote-${slug}`) === "1") setVoted(true);
  }, [slug]);

  const vote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (voted || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/directory/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, viewer: getViewerId() }),
      });
      if (res.ok) {
        setVotes((v) => v + 1);
        setVoted(true);
        localStorage.setItem(`otb-vote-${slug}`, "1");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={vote}
      disabled={voted || busy}
      aria-label="Upvote this tool"
      className={cn(
        "btn-base rounded-xl border flex-col !gap-0",
        compact ? "px-2.5 py-1.5" : "px-3.5 py-2",
        voted
          ? "bg-brand-600/25 border-brand-500/50 text-white cursor-default"
          : "glass text-zinc-300 hover:border-brand-500/50 hover:text-white"
      )}
    >
      {voted ? <Check size={compact ? 14 : 16} className="text-emerald-400" /> : <ChevronUp size={compact ? 14 : 16} />}
      <span className={cn("font-bold", compact ? "text-xs" : "text-sm")}>{votes.toLocaleString()}</span>
    </button>
  );
}
