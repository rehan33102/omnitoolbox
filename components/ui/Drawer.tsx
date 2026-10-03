"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export default function Drawer({
  open, onClose, children, title,
}: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open ]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute right-0 top-0 h-full w-[300px] glass-strong border-l border-white/10 p-5 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              {title ? <h3 className="font-display font-semibold">{title}</h3> : <span />}
              <button onClick={onClose} aria-label="Close menu" className="p-2 rounded-lg hover:bg-white/10 transition">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
