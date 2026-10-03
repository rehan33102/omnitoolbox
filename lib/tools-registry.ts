import type { Tool } from "@/types";

export const TOOLS: Tool[] = [
  {
    id: "t1", slug: "ai-prompt-studio", title: "AI Prompt Studio",
    tagline: "Generate & optimize prompts for Midjourney, ChatGPT, Flux & Claude",
    description: "Multi-input prompt builder with preset styles, negative-prompt bank and {variable} placeholders. One-click copy, history included.",
    category: "ai", href: "/ai-prompt-studio", icon: "Wand2", badge: "popular",
    enabled: true, sortOrder: 1, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t2", slug: "image-converter", title: "Image Converter",
    tagline: "Convert WebP ↔ PNG ↔ JPG instantly in your browser",
    description: "Client-side image format converter. Zero upload, zero lag — your files never leave the device.",
    category: "image", href: "/media-tools#converter", icon: "RefreshCw", badge: "popular",
    enabled: true, sortOrder: 2, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t3", slug: "image-compressor", title: "Image Compressor",
    tagline: "Shrink images up to 90% with zero visible quality loss",
    description: "Smart client-side compression with quality slider and max-dimension control.",
    category: "image", href: "/media-tools#compressor", icon: "Minimize2",
    enabled: true, sortOrder: 3, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t4", slug: "svg-cleaner", title: "SVG Cleaner",
    tagline: "Strip bloat from SVGs — smaller files, same pixels",
    description: "Removes comments, metadata, editor namespaces and scripts from SVG markup.",
    category: "image", href: "/media-tools#svg-cleaner", icon: "Paintbrush",
    enabled: true, sortOrder: 4, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t5", slug: "background-remover", title: "Background Remover",
    tagline: "Remove image backgrounds with one click",
    description: "Client-side background removal interface powered by in-browser ML.",
    category: "image", href: "/media-tools#bg-remover", icon: "Eraser", badge: "new",
    enabled: true, sortOrder: 5, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t6", slug: "fancy-text", title: "Fancy Text Stylizer",
    tagline: "Unicode text styles with live preview — copy anywhere",
    description: "50+ unicode font styles for bios, captions and posts. Live preview, one-click copy.",
    category: "social", href: "/social-tools#fancy-text", icon: "Type", badge: "popular",
    enabled: true, sortOrder: 6, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t7", slug: "bio-generator", title: "Bio Generator",
    tagline: "Instagram & TikTok bios that convert followers",
    description: "Niche-aware bio templates with emoji, CTA and line-break formatting.",
    category: "social", href: "/social-tools#bio-generator", icon: "UserRound",
    enabled: true, sortOrder: 7, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t8", slug: "hashtag-finder", title: "Hashtag Finder",
    tagline: "High-reach hashtags for every niche",
    description: "Curated hashtag packs balanced across high/medium/low competition.",
    category: "social", href: "/social-tools#hashtags", icon: "Hash",
    enabled: true, sortOrder: 8, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t9", slug: "ai-directory", title: "AI Tools Directory",
    tagline: "Discover newly launched AI tools, voted by the community",
    description: "Community-voted directory of new AI tools with categories, tags and honest rankings.",
    category: "ai", href: "/ai-directory", icon: "LayoutGrid",
    enabled: true, sortOrder: 9, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t10", slug: "ai-voiceover", title: "AI Voiceover Studio",
    tagline: "Turn text into natural AI voiceovers — free",
    description: "Free text-to-speech studio using your device's built-in AI voices. Pick a voice, tune rate & pitch, play instantly. Nothing uploaded.",
    category: "ai", href: "/ai-voiceover", icon: "Mic", badge: "new",
    enabled: true, sortOrder: 10, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t11", slug: "pdf-merge", title: "PDF Merger",
    tagline: "Combine multiple PDFs into one file",
    description: "Merge PDFs in your browser — reorder pages, one click, private. No uploads, no watermarks.",
    category: "pdf", href: "/pdf-tools", icon: "Files", badge: "popular",
    enabled: true, sortOrder: 11, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t12", slug: "pdf-split", title: "PDF Splitter",
    tagline: "Extract pages from any PDF",
    description: "Pick a page range and split it out into a new PDF — all client-side, all private.",
    category: "pdf", href: "/pdf-tools", icon: "Scissors",
    enabled: true, sortOrder: 12, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t13", slug: "images-to-pdf", title: "Images to PDF",
    tagline: "Turn JPG/PNG photos into a PDF",
    description: "Convert photos to a clean A4 PDF in seconds. Reorder pages, everything stays on your device.",
    category: "pdf", href: "/pdf-tools", icon: "FileImage",
    enabled: true, sortOrder: 13, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t14", slug: "qr-generator", title: "QR Code Generator",
    tagline: "Custom QR codes with colors — free download",
    description: "Generate scannable QR codes for links, text and WiFi. Custom colors, sizes and error correction.",
    category: "web", href: "/web-tools", icon: "QrCode", badge: "popular",
    enabled: true, sortOrder: 14, usageCount: 0, updatedAt: "2026-10-03",
  },
  {
    id: "t15", slug: "password-generator", title: "Password Generator",
    tagline: "Military-grade random passwords",
    description: "Cryptographically secure passwords with strength meter. Generated locally — never sent anywhere.",
    category: "web", href: "/web-tools", icon: "KeyRound",
    enabled: true, sortOrder: 15, usageCount: 0, updatedAt: "2026-10-03",
  },
];

export const getEnabledTools = (): Tool[] =>
  TOOLS.filter((t) => t.enabled).sort((a, b) => a.sortOrder - b.sortOrder);

export const getToolBySlug = (slug: string): Tool | undefined =>
  TOOLS.find((t) => t.slug === slug);

/** Merge DB overrides (admin toggles/edits + admin-added tools) over the registry. */
export function mergeTools(dbRows: Record<string, unknown>[]): Tool[] {
  const bySlug = new Map(dbRows.map((r) => [r.slug as string, r]));
  const merged: Tool[] = TOOLS.map((t) => ({ ...t, ...rowToPartial(bySlug.get(t.slug)) }));
  for (const row of dbRows) {
    if (!merged.some((t) => t.slug === row.slug)) {
      merged.push(rowToPartial(row) as Tool);
    }
  }
  return merged.sort((a, b) => a.sortOrder - b.sortOrder);
}

function rowToPartial(row: Record<string, unknown> | undefined): Partial<Tool> {
  if (!row) return {};
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    tagline: (row.tagline as string) ?? "",
    description: (row.description as string) ?? "",
    category: (row.category as Tool["category"]) ?? "web",
    href: (row.href as string) ?? `/${row.slug}`,
    icon: (row.icon as string) ?? "Wrench",
    badge: row.badge as Tool["badge"],
    enabled: row.enabled as boolean,
    sortOrder: (row.sort_order as number) ?? 99,
    usageCount: (row.usage_count as number) ?? 0,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}
