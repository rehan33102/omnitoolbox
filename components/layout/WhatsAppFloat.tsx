"use client";

import { useSiteSettings } from "@/hooks/useSiteSettings";
import { WHATSAPP_MESSAGE, whatsappUrl } from "@/lib/site-settings";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";

/**
 * Floating WhatsApp button — bottom-right on every page.
 * Number + message editable from /admin/settings → Social links.
 */
export default function WhatsAppFloat() {
  const { settings } = useSiteSettings();

  return (
    <a
      href={whatsappUrl(settings.whatsapp, WHATSAPP_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full
                 bg-[#25D366] text-zinc-900 dark:text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)]
                 transition-transform duration-200 hover:scale-110 active:scale-95"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" aria-hidden />
      <WhatsAppIcon size={28} className="relative" />
    </a>
  );
}
