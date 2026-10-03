import { cn } from "@/lib/utils";

export type BadgeVariant = "ai" | "image" | "social" | "web" | "text" | "pdf" | "new" | "pro" | "default";

const styles: Record<BadgeVariant, string> = {
  ai: "bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-500/30",
  image: "bg-accent-500/15 text-accent-600 dark:text-accent-300 border-accent-500/30",
  social: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  web: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  text: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  pdf: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  new: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  pro: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  default: "bg-black/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border-black/15 dark:border-white/15",
};

export default function Badge({
  children, variant = "default", className,
}: { children: React.ReactNode; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide", styles[variant], className)}>
      {children}
    </span>
  );
}
