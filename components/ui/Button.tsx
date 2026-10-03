"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white shadow-glow hover:brightness-110",
  secondary: "glass hover:bg-black/5 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-100",
  ghost: "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300",
  outline: "border border-black/15 dark:border-white/15 hover:border-brand-500/60 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white",
  danger: "bg-red-600/90 text-white hover:bg-red-600",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-7 py-3.5 text-base rounded-xl",
  icon: "p-2.5 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button ref={ref} className={cn("btn-base", variants[variant], sizes[size], className)} {...props} />
  )
);
Button.displayName = "Button";

export default Button;
