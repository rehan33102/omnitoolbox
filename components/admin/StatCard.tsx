import Card from "@/components/ui/Card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatCard({
  label, value, delta, icon: Icon,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: React.ElementType;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="!p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
        <Icon size={16} className="text-brand-400" />
      </div>
      <p className="font-display text-2xl font-bold mt-2">{value}</p>
      {delta !== undefined && (
        <p className={cn("flex items-center gap-1 text-xs mt-1", up ? "text-emerald-400" : "text-red-400")}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta)}% vs prior period
        </p>
      )}
    </Card>
  );
}
