/**
 * lib/ad-pages.ts — canonical list of public site routes for ad page-targeting.
 *
 * Derived from app/ page.tsx routes. Admin-only and API routes are excluded.
 * Used by the ad admin UI (checklist) and matched at runtime with usePathname.
 */
export interface PageTarget {
  path: string; // route path, e.g. "/ai-voiceover"
  label: string; // human label shown in admin
}

export const PAGE_TARGETS: PageTarget[] = [
  { path: "/", label: "Homepage" },
  { path: "/ai-voiceover", label: "AI Voiceover Studio" },
  { path: "/ai-prompt-studio", label: "AI Prompt Studio" },
  { path: "/calculators", label: "Calculators" },
  { path: "/media-tools", label: "Media Tools" },
  { path: "/pdf-tools", label: "PDF Tools" },
  { path: "/social-tools", label: "Social Tools" },
  { path: "/web-tools", label: "Web Tools" },
  { path: "/tools", label: "All tool pages (/tools/[slug])" },
  { path: "/ai-directory", label: "AI Directory" },
  { path: "/spotlight", label: "Spotlight" },
  { path: "/library", label: "Library" },
  { path: "/tutorial", label: "Tutorials" },
  { path: "/blog", label: "Blog" },
  { path: "/download", label: "Download App" },
  { path: "/contact", label: "Contact" },
  { path: "/hire-me", label: "Hire Me" },
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/terms", label: "Terms" },
];

/**
 * Does an ad targeting `pages` show on `pathname`?
 * - Empty pages array = show on all listed pages.
 * - "/tools" matches "/tools" and any "/tools/..." sub-route.
 */
export function adMatchesPage(pages: string[] | undefined, pathname: string): boolean {
  if (!pages || pages.length === 0) return true;
  return pages.some((p) => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(p + "/");
  });
}
