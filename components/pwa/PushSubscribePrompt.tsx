"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import Button from "@/components/ui/Button";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "hidden" | "prompt" | "working" | "done" | "blocked";

const STORE_KEY = "otb-push-prompt";

/**
 * Push subscription prompt. Shows only when the browser genuinely supports
 * Notification + service worker + PushManager, the user hasn't decided yet,
 * and no push subscription exists. Mount once (e.g. in the root layout).
 */
export default function PushSubscribePrompt() {
  const [state, setState] = useState<State>("hidden");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (localStorage.getItem(STORE_KEY)) return; // already decided
        if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
        if (Notification.permission === "denied") return;
        // Push not configured server-side → nothing to subscribe to
        const cfg = await fetch("/api/push/subscribe", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
        if (!cfg?.configured || !cfg?.publicKey) return;
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          localStorage.setItem(STORE_KEY, "subscribed");
          return;
        }
        if (Notification.permission === "default" && !cancelled) setState("prompt");
      } catch {
        /* prompt is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = (value: string) => {
    try {
      localStorage.setItem(STORE_KEY, value);
    } catch {
      /* ignore */
    }
    setState("hidden");
  };

  const subscribe = async () => {
    setState("working");
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("blocked");
        dismiss("denied");
        return;
      }
      const cfg = await fetch("/api/push/subscribe", { cache: "no-store" }).then((r) => r.json());
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Server rejected the subscription");
      setState("done");
      dismiss("subscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subscription failed");
      setState("prompt");
    }
  };

  if (state === "hidden" || state === "done") return null;

  return (
    <div className="fixed bottom-5 left-5 z-[90] max-w-xs rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="p-2 rounded-xl bg-ember-500/15 text-ember-600 shrink-0">
          <Bell size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Stay in the loop</p>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            Get a notification when new tools and updates drop.
          </p>
          {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={subscribe} disabled={state === "working"}>
              {state === "working" ? "Enabling…" : "Enable"}
            </Button>
            <button
              type="button"
              onClick={() => dismiss("dismissed")}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-2 py-1"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismiss("dismissed")}
          aria-label="Dismiss"
          className="rounded-full p-1 text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
        >
          <X size={14} />
        </button>
      </div>
      {state === "blocked" && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 mt-2">
          <BellOff size={12} /> Notifications are blocked for this site in your browser settings.
        </p>
      )}
    </div>
  );
}
