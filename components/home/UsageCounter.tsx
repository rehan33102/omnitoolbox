"use client";

import { useEffect, useState } from "react";
import { useReveal } from "@/hooks/useReveal";
import { cn } from "@/lib/utils";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const { ref, visible } = useReveal<HTMLSpanElement>();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!visible || to === 0) return;
    const start = performance.now();
    const dur = 1600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, to]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

export default function UsageCounter({ toolCount }: { toolCount: number }) {
  const [uses, setUses] = useState(0);
  const { ref, visible } = useReveal<HTMLDivElement>();

  useEffect(() => {
    fetch("/api/stats/public")
      .then((r) => r.json())
      .then((j) => setUses(j.totalUses ?? 0))
      .catch(() => {});
    const id = setInterval(() => {
      fetch("/api/stats/public").then((r) => r.json()).then((j) => setUses(j.totalUses ?? 0)).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { value: <CountUp to={toolCount} suffix="+" />, label: "Free tools" },
    { value: <CountUp to={uses} suffix="+" />, label: "Tool uses tracked" },
    { value: <CountUp to={100} suffix="%" />, label: "Free forever" },
    { value: <CountUp to={0} />, label: "Sign-up required" },
  ];

  return (
    <section className="container">
      <div
        ref={ref}
        className={cn(
          "reveal-scale relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900",
          visible && "is-visible"
        )}
      >
        {/* warm glow accents */}
        <div className="absolute -top-20 left-1/4 h-40 w-40 rounded-full bg-ember-500/20 blur-[80px] pointer-events-none" aria-hidden />
        <div className="absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-magent-500/15 blur-[80px] pointer-events-none" aria-hidden />
        <div className="relative grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/5">
          {stats.map((s) => (
            <div key={s.label} className="p-6 md:p-8 text-center">
              <p className="font-condensed text-4xl md:text-5xl text-gradient-warm tracking-tight">{s.value}</p>
              <p className="text-[11px] text-zinc-500 mt-2 uppercase tracking-[0.25em]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
