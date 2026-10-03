import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import VoteButtons from "./VoteButtons";
import type { AIToolListing } from "@/types";

export default function DirectoryCard({ tool }: { tool: AIToolListing }) {
  const visitUrl = tool.affiliateUrl ?? tool.url;

  return (
    <Card hover className="flex gap-4">
      <VoteButtons slug={tool.slug} initialVotes={tool.votes} compact />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/ai-directory/${tool.slug}`} className="font-display font-semibold hover:text-brand-300 transition">
            {tool.name}
          </Link>
          {tool.featured && <Badge variant="pro">Featured</Badge>}
          <Badge variant="default">{tool.category}</Badge>
        </div>
        <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{tool.tagline}</p>
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-1.5 flex-wrap">
            {tool.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[11px] text-zinc-500">#{t}</span>
            ))}
          </div>
          <a
            href={visitUrl}
            target="_blank"
            rel="noopener sponsored"
            className="btn-base px-3.5 py-1.5 text-xs rounded-lg bg-brand-600/20 border border-brand-500/40 hover:bg-brand-600/35 transition shrink-0"
          >
            Visit <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </Card>
  );
}
