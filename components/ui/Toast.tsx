"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info";
interface ToastItem { id: number; title: string; description?: string; variant: ToastVariant; }

interface ToastContextValue {
  toast: (t: Omit<ToastItem, "id">) => void;
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<ToastContextValue>({
  toast: () => {},
  toasts: [],
  dismiss: () => {},
});
export const useToast = () => useContext(ToastCtx);

let nextId = 0;
const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const iconColor = { success: "text-emerald-400", error: "text-red-400", info: "text-accent-400" };

/** Wraps the app so every useToast() call actually displays a toast. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++nextId;
    setToasts((p) => [...p.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((p) => p.filter((x) => x.id !== id)), []);

  return <ToastCtx.Provider value={{ toast, toasts, dismiss }}>{children}</ToastCtx.Provider>;
}

/** Renders the floating toast stack. Must live inside <ToastProvider>. */
export function Toaster() {
  const { toasts, dismiss } = useContext(ToastCtx);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(320px,calc(100vw-2rem))]">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.variant];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="glass-strong rounded-xl p-3.5 flex gap-3 shadow-glass"
            >
              <Icon size={20} className={iconColor[t.variant]} />
              <div className="flex-1 text-sm">
                <p className="font-medium">{t.title}</p>
                {t.description && <p className="text-zinc-400 text-xs mt-0.5">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                <X size={16} className="text-zinc-500 hover:text-white" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
