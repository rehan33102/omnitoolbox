"use client";

import Link from "next/link";
import { Github, Instagram, Youtube } from "lucide-react";
import { TOOL_CATEGORIES } from "@/lib/constants";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useBranding } from "@/hooks/useBranding";
import { TikTokIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { WHATSAPP_MESSAGE, normalizeWhatsapp } from "@/lib/site-settings";
import LogoMark from "@/components/layout/LogoMark";

/** X (Twitter) glyph — lucide doesn't ship a brand X icon. */
function XIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const COMPANY_LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/ai-directory", label: "AI Directory" },
  { href: "/library", label: "Library" },
  { href: "/contact", label: "Contact" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export default function Footer() {
  const { settings } = useSiteSettings();
  const { branding } = useBranding();
  const waNumber = normalizeWhatsapp(settings.whatsapp);

  // Branding socials (Supabase KV) win per-link; settings stay the fallback.
  const socials = [
    settings.whatsapp && {
      label: "WhatsApp",
      href: `https://wa.me/${waNumber}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
      Icon: WhatsAppIcon,
    },
    (branding.socialTiktok || settings.tiktok) && {
      label: "TikTok",
      href: branding.socialTiktok || settings.tiktok,
      Icon: TikTokIcon,
    },
    (branding.socialInstagram || settings.instagram) && {
      label: "Instagram",
      href: branding.socialInstagram || settings.instagram,
      Icon: Instagram,
    },
    branding.socialX && { label: "X", href: branding.socialX, Icon: XIcon },
    branding.socialYoutube && { label: "YouTube", href: branding.socialYoutube, Icon: Youtube },
    settings.github && { label: "GitHub", href: settings.github, Icon: Github },
  ].filter(Boolean) as { label: string; href: string; Icon: (p: { size?: number }) => JSX.Element }[];

  const accentNameStyle = branding.accentColor
    ? {
        backgroundImage: `linear-gradient(100deg, ${branding.accentColor} 0%, color-mix(in srgb, ${branding.accentColor} 55%, #22d3ee) 100%)`,
      }
    : undefined;

  return (
    <footer className="border-t border-black/10 dark:border-white/10 mt-16">
      <div className="container py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* Brand + social */}
        <div>
          <Link href="/" className="flex items-center gap-3 mb-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                className="h-10 w-10 rounded-xl object-cover"
                alt="logo"
              />
            ) : (
              <LogoMark size={40} />
            )}
            <span className="brand-name" style={accentNameStyle}>
              {branding.siteName || settings.logoText}
            </span>
          </Link>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs leading-relaxed">
            {branding.footerText || branding.tagline || settings.tagline}
          </p>
          <div className="flex gap-2 mt-4">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                title={label}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl glass text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {/* Tools */}
        <nav aria-label="Tools">
          <h4 className="font-display font-semibold mb-3 text-xs uppercase tracking-widest text-zinc-700 dark:text-zinc-300">Tools</h4>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {TOOL_CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link href={`/?cat=${c.id}#tools`} className="hover:text-zinc-900 dark:hover:text-white transition">{c.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Company */}
        <nav aria-label="Company">
          <h4 className="font-display font-semibold mb-3 text-xs uppercase tracking-widest text-zinc-700 dark:text-zinc-300">Company</h4>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {COMPANY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-zinc-900 dark:hover:text-white transition">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Legal */}
        <nav aria-label="Legal">
          <h4 className="font-display font-semibold mb-3 text-xs uppercase tracking-widest text-zinc-700 dark:text-zinc-300">Legal</h4>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-zinc-900 dark:hover:text-white transition">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-black/10 dark:border-white/10">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} {branding.siteName || settings.siteName}. All rights reserved.</p>
          <p>Made by Rehan</p>
        </div>
      </div>
    </footer>
  );
}
