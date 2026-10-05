"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { WHATSAPP_MESSAGE, whatsappUrl } from "@/lib/site-settings";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";

const DISMISS_KEY = "omnitoolbox-wa-dismissed-at";
// Reappear after 7 minutes
const REAPPEAR_MS = 7 * 60 * 1000;

/**
 * Floating WhatsApp button — bottom-right on every page.
 * Dismissible via X button, but reappears after 7 minutes.
 * Number + message editable from /admin/settings → Social links.
 */
export default function WhatsAppFloat() {
  const { settings } = useSiteSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || "0");
        const elapsed = Date.now() - dismissedAt;
        setVisible(dismissedAt === 0 || elapsed >= REAPPEAR_MS);
      } catch {
        setVisible(true);
      }
    };
    check();
    // Re-check every 30s in case the timer expired while page is open
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <div className="relative">
        <button
          onClick={dismiss}
          aria-label="Hide WhatsApp button"
          title="Hide for 7 minutes"
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
