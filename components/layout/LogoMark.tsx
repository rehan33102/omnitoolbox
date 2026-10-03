"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand logo mark with soft blinking light animation around it.
 * The PNG has a transparent background so it blends into dark and light mode.
 */
export default function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("logo-glow-wrap relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <span className="logo-glow" aria-hidden />
      <Image
        src="/images/logo.png"
        alt="OmniToolBox logo"
        width={size}
        height={size}
        className="relative z-10 h-full w-full object-contain drop-shadow-[0_2px_10px_rgba(168,85,247,0.45)]"
        priority
      />
    </span>
  );
}
