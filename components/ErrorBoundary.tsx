"use client";

import { Component, type ReactNode } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/** Dedupe client error reports so a loop doesn't spam the endpoint. */
const seen = new Set<string>();
export function reportClientError(info: {
  message: string;
  stack?: string;
  component?: string;
  extra?: unknown;
}) {
  try {
    const key = `${info.component ?? ""}:${info.message}`.slice(0, 200);
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 50) seen.clear();
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...info, url: window.location.href }),
    }).catch(() => {});
  } catch {
    /* never break the app while reporting */
  }
}

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Global error boundary — catches render crashes anywhere in the tree,
 * shows a friendly fallback, and reports the error to /api/log-error.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportClientError({
      message: error.message,
      stack: error.stack,
      component: this.props.name ?? "ErrorBoundary",
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-16 max-w-md mx-auto">
          <Card className="text-center">
            <p className="text-4xl mb-3">😢</p>
            <h2 className="font-bold text-lg mb-2">Kuch ghalat ho gaya</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Page load nahi ho saka. Dobara try karo — error hum tak pahunch gaya hai.
            </p>
            <Button onClick={() => window.location.reload()}>Dobara Load Karo 🔄</Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
