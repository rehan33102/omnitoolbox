"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/ErrorBoundary";

/**
 * Global client error hooks — captures unhandled JS errors and
 * unhandled promise rejections, reports them to /api/log-error.
 */
export default function GlobalErrorHooks() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      reportClientError({
        message: e.message,
        component: "window.onerror",
        extra: { filename: e.filename, lineno: e.lineno },
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      reportClientError({
        message: reason instanceof Error ? reason.message : String(reason).slice(0, 500),
        stack: reason instanceof Error ? reason.stack : undefined,
        component: "unhandledrejection",
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
