"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-ember-500 via-magent-500 to-ember-500 bg-[length:200%_100%] text-white font-bold shadow-glow-warm hover:bg-right hover:scale-[1.03] hover:shadow-[0_8px_32px_rgba(255,100,50,0.4)] active:scale-[0.98] transition-all duration-300",
  secondary: "glass font-semibold hover:bg-black/5 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-100 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] transition-all duration-200",
  ghost: "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:scale-[1.02] transition-all duration-200",
  outline: "border-2 border-black/15 dark:border-white/15 hover:border-ember-500/60 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:shadow-md hover:-translate-y-px transition-all duration-200",
  danger: "bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold hover:brightness-110 hover:scale-[1.03] active:scale-[0.98] shadow-lg transition-all duration-200",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-xs rounded-full",
  md: "px-6 py-3 text-sm rounded-full",
  lg: "px-8 py-4 text-base rounded-full",
  icon: "p-3 rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button ref={ref} className={cn("btn-base", "btn-press", variants[variant], sizes[size], className)} {...props} />
  )
);
Button.displayName = "Button";

export default Button;
