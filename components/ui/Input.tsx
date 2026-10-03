"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
}

function FieldWrap({ label, error, hint, children, htmlFor }: FieldProps & { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      {label && <span className="block text-sm font-medium mb-1.5 text-zinc-300">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-zinc-500 mt-1.5">{hint}</span>}
      {error && <span className="block text-xs text-red-400 mt-1.5">{error}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => (
    <FieldWrap label={label} error={error} hint={hint} htmlFor={id}>
      <input ref={ref} id={id} className={cn("input-base", error && "ring-2 ring-red-500/60", className)} {...props} />
    </FieldWrap>
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => (
    <FieldWrap label={label} error={error} hint={hint} htmlFor={id}>
      <textarea ref={ref} id={id} className={cn("input-base min-h-[120px] resize-y", error && "ring-2 ring-red-500/60", className)} {...props} />
    </FieldWrap>
  )
);
Textarea.displayName = "Textarea";
