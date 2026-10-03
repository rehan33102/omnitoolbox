import { Reveal } from "@/hooks/useReveal";
import { cn } from "@/lib/utils";

/**
 * SectionHeader — ORYZO-style editorial section header.
 * Magazine eyebrow + giant condensed uppercase title + optional sub copy.
 */
export default function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "mb-10 md:mb-12",
        align === "center" ? "text-center" : "text-left",
        className
      )}
    >
      <p className={cn("eyebrow mb-4", align === "center" && "justify-center")}>{eyebrow}</p>
      <h2 className="font-condensed uppercase leading-[0.95] tracking-tight text-4xl sm:text-5xl md:text-6xl">
        {title}
      </h2>
      {sub && (
        <p className={cn("mt-4 text-zinc-600 dark:text-zinc-400 text-sm md:text-base max-w-xl leading-relaxed", align === "center" && "mx-auto")}>
          {sub}
        </p>
      )}
    </Reveal>
  );
}
