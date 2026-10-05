"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Simple reliable drawer — renders immediately when open, no complex animation state. */
export default function Drawer({
  open, onClose, children, title,
}: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open ]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-[300px] max-w-[85vw] overflow-y-auto p-5",
          "bg-white dark:bg-zinc-900 border-l border-black/10 dark:border-white/10 shadow-2xl",
          "animate-[drawer-slide-in_0.25s_ease-out]"
        )}
      >
        <div className="flex items-center justify-between mb-6">
          {title ? <h3 className="font-display font-semibold text-zinc-900 dark:text-white">{title}</h3> : <span />}
          <button onClick={onClose} aria-label="Close menu" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-zinc-900 dark:text-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
      <style>{`@keyframes drawer-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}
