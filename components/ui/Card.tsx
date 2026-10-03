import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function Card({
  children, className, hover = false,
}: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn("glass rounded-2xl p-5", hover && "card-hover", className)}>
      {children}
    </div>
  );
}
