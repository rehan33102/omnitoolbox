import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Skeleton shown while a heavy tool chunk loads.
 * Keeps layout stable (no CLS) and makes tab switches feel instant.
 */
export function ToolLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading tool">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

/**
 * Lazily load a heavy tool component so its JS (e.g. pdf-lib, qrcode,
 * the BG-removal engine UI) only downloads when the user opens its tab.
 * Safe to use from Server Components.
 */
export function lazyTool<T extends ComponentType<Record<string, never>>>(
  importer: () => Promise<{ default: T }>
) {
  return dynamic(importer, {
    ssr: false,
    loading: () => <ToolLoading />,
  });
}
