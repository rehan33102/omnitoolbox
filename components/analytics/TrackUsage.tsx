"use client";

import { useEffect } from "react";
import { useTrackToolUsage } from "@/hooks/useTrackToolUsage";

/** Drop on any tool page — logs a page_view for the analytics dashboard. */
export default function TrackUsage({ slug }: { slug: string }) {
  const { track } = useTrackToolUsage();
  useEffect(() => {
    track(slug, "page_view");
  }, [slug, track]);
  return null;
}
