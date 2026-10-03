"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * usePersistentState — localStorage-backed state, SSR-safe.
 *
 * Reads the stored value lazily on mount (so server HTML matches the
 * initial render), writes on every change, and re-reads when `key` changes.
 * Never throws — storage failures are swallowed silently.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* keep initial */
    }
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full / unavailable — keep in-memory value */
    }
  }, [key, value]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setValue(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue, clear] as const;
}
