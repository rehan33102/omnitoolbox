"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * CSS-transition modal (no framer-motion): mounts instantly, animates
 * opacity/scale via GPU-friendly transforms, unmounts after exit.
 */
export default function Modal({
  open, onClose, title, children, wide = false,
}: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setRender(true);
      // Next frame → trigger enter transition
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setRender(false), 200); // match transition duration
    return () => clearTimeout(t);
  }, [open ]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          shown ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative glass-strong rounded-2xl p-6 w-full shadow-glass max-h-[90vh] overflow-y-auto",
          "transition-all duration-200 ease-out will-change-transform",
          shown ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-3",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          {title ? <h3 className="font-display text-lg font-semibold">{title}</h3> : <span />}
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
