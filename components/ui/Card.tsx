import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function Card({
  children, className, hover = false,
}: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn(
      "glass rounded-3xl p-6 border border-black/[0.06] dark:border-white/[0.08]",
      "shadow-[0_2px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.3)]",
      hover && "card-hover hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:border-ember-500/20 transition-all duration-300",
      className
    )}>
      {children}
    </div>
  );
}
