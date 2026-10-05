"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { WHATSAPP_MESSAGE, whatsappUrl } from "@/lib/site-settings";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";

const DISMISS_KEY = "omnitoolbox-wa-dismissed";

/**
 * Floating WhatsApp button — bottom-right on every page.
 * Dismissible: user can close it via the X button, choice saved in localStorage.
 * Number + message editable from /admin/settings → Social links.
 */
export default function WhatsAppFloat() {
  const { settings } = useSiteSettings();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    try {
      const was = localStorage.getItem(DISMISS_KEY) === "1";
      setDismissed(was);
      if (!was) {
        // Show a friendly tip bubble briefly on first view
        const t = setTimeout(() => setShowTip(true), 1500);
        const t2 = setTimeout(() => setShowTip(false), 9000);
        return () => { clearTimeout(t); clearTimeout(t2); };
      }
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    setShowTip(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  if (dismissed) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {showTip && (
        <div className="relative max-w-[220px] rounded-2xl rounded-br-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-3 shadow-xl animate-fade-up">
          <button
            onClick={() => setShowTip(false)}
            aria-label="Dismiss tip"
            className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-zinc-700 dark:bg-zinc-200 text-white dark:text-zinc-800 shadow"
          >
            <X size={13} />
          </button>
          <p className="text-xs font-medium leading-snug">
            Need help? Chat with us on WhatsApp! 💬
          </p>
        </div>
      )}
      <div className="relative">
        <button
          onClick={dismiss}
          aria-label="Hide WhatsApp button"
          title="Hide"
          className="absolute -top-2 -left-2 z-10 grid size-6 place-items-center rounded-full
                     bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800 shadow-md
                     hover:scale-110 transition-transform"
        >
          <X size={13} />
        </button>
        <a
          href={whatsappUrl(settings.whatsapp, WHATSAPP_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          title="Chat on WhatsApp"
          className="grid size-14 place-items-center rounded-full
                     bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)]
                     transition-transform duration-200 hover:scale-110 active:scale-95"
        >
          <WhatsAppIcon size={28} className="relative" />
        </a>
      </div>
    </div>
  );
}
