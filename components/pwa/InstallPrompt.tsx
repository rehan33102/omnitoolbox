"use client";

import { useEffect, useState } from "react";
import { Download, MonitorDown, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/** Desktop/mobile PWA install banner — "Install Omni Tool Box on your PC". */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // already running as installed PWA?
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // don't nag: hide for 7 days after dismiss
    try {
      const d = localStorage.getItem("pwa-dismiss");
      if (d && Date.now() - Number(d) < 7 * 24 * 3600 * 1000) setDismissed(true);
    } catch { /* ignore */ }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred || dismissed || installed) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("pwa-dismiss", String(Date.now())); } catch { /* ignore */ }
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-40 animate-in slide-in-from-bottom-4">
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-4 shadow-2xl text-white">
        <button onClick={dismiss} aria-label="Dismiss"
          className="absolute top-2 right-2 grid place-items-center size-7 rounded-full bg-black/20 hover:bg-black/40">
          <X size={14} />
        </button>
        <div className="flex items-start gap-3">
          <span className="grid place-items-center size-11 rounded-xl bg-white/20 shrink-0">
            <MonitorDown size={22} />
          </span>
          <div className="flex-1">
            <p className="font-bold text-sm">Install Omni Tool Box</p>
            <p className="text-xs text-white/80 mt-0.5">
              Get the desktop app — faster, offline-ready, one click to open!
            </p>
            <button onClick={install}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white text-violet-700 text-xs font-bold px-4 py-2 hover:scale-105 transition">
              <Download size={14} /> Install on this PC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
