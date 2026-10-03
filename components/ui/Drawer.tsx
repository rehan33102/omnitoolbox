"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** CSS-transition drawer (no framer-motion): GPU-friendly translate-x slide. */
export default function Drawer({
  open, onClose, children, title,
}: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open ]);

  useEffect(() => {
    if (open) {
      setRender(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setRender(false), 250);
    return () => clearTimeout(t);
  }, [open ]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-250",
          shown ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-[300px] glass-strong border-l border-white/10 p-5 overflow-y-auto",
          "transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          shown ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between mb-6">
          {title ? <h3 className="font-display font-semibold">{title}</h3> : <span />}
          <button onClick={onClose} aria-label="Close menu" className="p-2 rounded-lg hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
