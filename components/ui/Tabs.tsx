"use client";

import { createContext, useContext, useState, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const TabsCtx = createContext<{ value: string; set: (v: string) => void }>({
  value: "",
  set: () => {},
});

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: ReactNode; className?: string }) {
  const [value, set] = useState(defaultValue);
  return <TabsCtx.Provider value={{ value, set }}><div className={className}>{children}</div></TabsCtx.Provider>;
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("glass inline-flex rounded-xl p-1 gap-1 max-w-full overflow-x-auto", className)}>{children}</div>;
}

export function TabsTrigger({ value, children, icon: Icon, className, onClick }: { value: string; children: ReactNode; icon?: React.ElementType; className?: string; onClick?: () => void }) {
  const { value: v, set } = useContext(TabsCtx);
  const active = v === value;
  return (
    <button
      onClick={() => { set(value); onClick?.(); }}
      className={cn(
        "btn-base px-4 py-2 text-sm rounded-lg whitespace-nowrap",
        active ? "bg-brand-600 text-white shadow-glow" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
        className
      )}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className, ...rest }: { value: string; children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  const { value: v } = useContext(TabsCtx);
  if (v !== value) return null;
  return <div className={cn("mt-4 animate-fade-up", className)} {...rest}>{children}</div>;
}
