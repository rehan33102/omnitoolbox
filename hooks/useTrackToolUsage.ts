"use client";

import { useCallback } from "react";

export function getViewerId(): string {
  let v = localStorage.getItem("otb-viewer");
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem("otb-viewer", v);
  }
  return v;
}

export function useTrackToolUsage() {
  const track = useCallback((toolSlug: string, action = "use") => {
    try {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolSlug, action, viewer: getViewerId() }),
      }).catch(() => {});
    } catch { /* never break UX */ }
  }, []);
  return { track };
}
