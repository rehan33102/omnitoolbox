import Link from "next/link";
import { Github, Instagram, Sparkles, Twitter, Youtube } from "lucide-react";
import { NAV_LINKS, SITE_NAME, TOOL_CATEGORIES } from "@/lib/constants";

const SOCIALS = [
  { icon: Twitter, href: "https://x.com", label: "Twitter" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
  { icon: Github, href: "https://github.com", label: "GitHub" },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-20">
      <div className="container py-12 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500">
              <Sparkles size={18} className="text-white" />
            </span>
            <span className="font-display text-lg font-bold">
              Omni<span className="text-gradient">ToolBox</span>
            </span>
          </div>
          <p className="text-sm text-zinc-400 max-w-xs">
            50+ free AI & web utilities. Fast, private, no signup — built for creators, marketers and developers.
          </p>
          <div className="flex gap-2 mt-5">
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} aria-label={s.label} target="_blank" rel="noopener"
                className="p-2.5 rounded-xl glass hover:bg-white/10 transition">
                <s.icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-zinc-300">Tools</h4>
          <ul className="space-y-2.5 text-sm text-zinc-400">
            {TOOL_CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link href={`/?cat=${c.id}#tools`} className="hover:text-white transition">{c.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-zinc-300">Explore</h4>
          <ul className="space-y-2.5 text-sm text-zinc-400">
            {NAV_LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className="hover:text-white transition">{l.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-zinc-300">Legal</h4>
          <ul className="space-y-2.5 text-sm text-zinc-400">
            <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
            <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
            <li><Link href="/admin" className="hover:text-white transition">Admin</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
          <p>Made for the open web — fast, private, free.</p>
        </div>
      </div>
    </footer>
  );
}
