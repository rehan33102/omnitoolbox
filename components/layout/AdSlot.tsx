"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AdSlotProps {
  slot: string;
  format?: "auto" | "horizontal" | "rectangle";
  className?: string;
}

/** AdSense-safe lazy ad container. Renders a labeled placeholder when no client/slot is configured. */
export default function AdSlot({ slot, format = "auto", className }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    if (!client || !slot || !ref.current) return;
    try {
      const w = window as unknown as { adsbygoogle: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch { /* adblock or not loaded yet */ }
  }, [client, slot]);

  if (!client || !slot) {
    return (
      <div className={cn("glass rounded-2xl grid place-items-center min-h-[90px] text-xs text-zinc-500 uppercase tracking-widest", className)}>
        Advertisement
      </div>
    );
  }

  const style =
    format === "horizontal" ? { display: "block", minHeight: 90 } :
    format === "rectangle" ? { display: "block", minHeight: 250 } :
    { display: "block" };

  return (
    <div ref={ref} className={cn("overflow-hidden rounded-2xl", className)}>
      <span className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
