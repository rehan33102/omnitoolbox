import Link from "next/link";
import Card from "@/components/ui/Card";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatCard({
  label, value, delta, icon: Icon, href,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: React.ElementType;
  /** When set, the whole card becomes a link to this admin detail page. */
  href?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
        <span className="flex items-center gap-1.5">
          {href && (
            <ArrowUpRight
              size={14}
              className="text-zinc-400 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all"
            />
          )}
          <Icon size={16} className="text-brand-700 dark:text-brand-400" />
        </span>
      </div>
      <p className="font-display text-2xl font-bold mt-2">{value}</p>
      {delta !== undefined && (
        <p className={cn("flex items-center gap-1 text-xs mt-1", up ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta)}% vs prior period
        </p>
      )}
      {href && (
        <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          View details →
        </p>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={`${label} — view details`} className="group block rounded-3xl">
        <Card hover className="!p-4 cursor-pointer hover:ring-2 hover:ring-brand-500/40 transition-shadow">
          {body}
        </Card>
      </Link>
    );
  }
  return <Card className="!p-4">{body}</Card>;
}
