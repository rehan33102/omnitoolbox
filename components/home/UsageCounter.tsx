"use client";

import { useEffect, useRef, useState } from "react";

/** Tiny IntersectionObserver hook — replaces framer-motion's useInView. */
function useInViewOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView]);
  return { ref, inView };
}

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const { ref, inView } = useInViewOnce<HTMLSpanElement>();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView || to === 0) return;
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
  }, [inView, to]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

export default function UsageCounter({ toolCount }: { toolCount: number }) {
  const [uses, setUses] = useState(0);

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
      <div className="glass rounded-3xl grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5 overflow-hidden">
        {stats.map((s) => (
          <div key={s.label} className="p-6 text-center">
            <p className="font-display text-2xl md:text-3xl font-extrabold text-gradient">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
