"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
const iconColor = { success: "text-emerald-700 dark:text-emerald-400", error: "text-red-600 dark:text-red-400", info: "text-accent-600 dark:text-accent-400" };

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
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

/** CSS-animated toast card (no framer-motion): slides in on mount. */
function ToastCard({ t, dismiss }: { t: ToastItem; dismiss: (id: number) => void }) {
  const Icon = icons[t.variant];
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={cn(
        "glass-strong rounded-xl p-3.5 flex gap-3 shadow-glass",
        "transition-all duration-200 ease-out will-change-transform",
        shown ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
      )}
    >
      <Icon size={20} className={iconColor[t.variant]} />
      <div className="flex-1 text-sm">
        <p className="font-medium">{t.title}</p>
        {t.description && <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-0.5">{t.description}</p>}
      </div>
      <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
        <X size={16} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white" />
      </button>
    </div>
  );
}
