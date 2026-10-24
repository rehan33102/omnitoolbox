"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * ORIGAMI MOTION — page transition wrapper.
 *
 * Every client-side navigation remounts this wrapper (keyed by pathname),
 * so every page the user opens replays the same soft spring entrance:
 * fade + gentle rise, transform/opacity only (GPU-composited, no layout
 * thrash). No fill mode on purpose: once the entrance finishes, the
 * wrapper holds no transform, so fixed/sticky elements inside pages keep
 * positioning against the viewport exactly as before.
 *
 * Respects prefers-reduced-motion via the .otb-page-enter override in
 * globals.css (animation: none). Content is never hidden without the
 * animation — opacity starts at 1 unless the keyframes are running.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="otb-page-enter">
      {children}
    </div>
  );
}
