"use client";

import Link from "next/link";
import { Github, Instagram, Sparkles } from "lucide-react";
import { TOOL_CATEGORIES } from "@/lib/constants";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { TikTokIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { WHATSAPP_MESSAGE, normalizeWhatsapp } from "@/lib/site-settings";

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
  const waNumber = normalizeWhatsapp(settings.whatsapp);

  const socials = [
    settings.whatsapp && {
      label: "WhatsApp",
      href: `https://wa.me/${waNumber}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
      Icon: WhatsAppIcon,
    },
    settings.tiktok && { label: "TikTok", href: settings.tiktok, Icon: TikTokIcon },
    settings.instagram && { label: "Instagram", href: settings.instagram, Icon: Instagram },
    settings.github && { label: "GitHub", href: settings.github, Icon: Github },
  ].filter(Boolean) as { label: string; href: string; Icon: (p: { size?: number }) => JSX.Element }[];

  return (
    <footer className="border-t border-black/10 dark:border-white/10 mt-16">
      <div className="container py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* Brand + social */}
        <div>
          <Link href="/" className="flex items-center gap-2.5 mb-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500">
              <Sparkles size={18} className="text-zinc-900 dark:text-white" />
            </span>
            <span className="font-display text-lg font-bold text-gradient">{settings.logoText}</span>
          </Link>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs leading-relaxed">{settings.tagline}</p>
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
            <li>
              <Link href="/admin" className="hover:text-zinc-900 dark:hover:text-white transition">Admin</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-black/10 dark:border-white/10">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} {settings.siteName}. All rights reserved.</p>
          <p>Fast · Private · Free</p>
        </div>
      </div>
    </footer>
  );
}
