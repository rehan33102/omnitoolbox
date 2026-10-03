import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { BlogPost } from "@/types";

export default function ArticleCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <Card hover className="h-full flex flex-col">
        <div className="flex gap-1.5 flex-wrap mb-3">
          {post.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="ai">{t}</Badge>
          ))}
        </div>
        <h3 className="font-display font-semibold text-lg leading-snug mb-2">{post.title}</h3>
        <p className="text-sm text-zinc-400 line-clamp-2 flex-1">{post.excerpt}</p>
        <div className="flex items-center justify-between mt-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Clock size={12} /> {post.readingMinutes} min read
          </span>
          <span className="flex items-center gap-1 text-brand-400">
            Read <ArrowRight size={13} />
          </span>
        </div>
      </Card>
    </Link>
  );
}
