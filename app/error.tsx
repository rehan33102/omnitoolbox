"use client";

import Button from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container py-24 text-center">
      <h2 className="font-display text-2xl font-bold mb-3">Something went wrong</h2>
      <p className="text-zinc-500 text-sm mb-6">{error.message || "An unexpected error occurred."}</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
