"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export function useCopyToClipboard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string, label = "Copied to clipboard") => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      toast({ title: label, variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    },
    [toast]
  );

  return { copy, copied };
}
