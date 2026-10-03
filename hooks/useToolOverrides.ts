"use client";

import { useEffect, useState } from "react";
import {
  TOOL_OVERRIDES_EVENT,
  getToolOverrides,
  type ToolOverride,
} from "@/lib/tool-overrides";

/**
 * useToolOverrides — client-side tool edits from /admin/tools.
 * Loads the IndexedDB/localStorage overrides on mount and re-loads whenever
 * the admin panel saves (same tab via event, other tabs via storage event).
 */
export function useToolOverrides() {
  const [overrides, setOverrides] = useState<Record<string, ToolOverride>>({});

  useEffect(() => {
    let alive = true;
    const reload = () => getToolOverrides().then((m) => alive && setOverrides(m));
    reload();
    const onEvent = (e: Event) => setOverrides((e as CustomEvent<Record<string, ToolOverride>>).detail);
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("otb:named:tool-overrides:")) reload();
    };
    window.addEventListener(TOOL_OVERRIDES_EVENT, onEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      alive = false;
      window.removeEventListener(TOOL_OVERRIDES_EVENT, onEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return overrides;
}
