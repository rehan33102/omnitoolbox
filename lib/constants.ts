export const SITE_NAME = "Omni Tool Box";
export const SITE_TAGLINE = "50+ free AI & web utilities. No signup required.";

export const NAV_LINKS = [
  { href: "/", label: "Home", icon: "Home" },
  { href: "/ai-prompt-studio", label: "Prompt Studio", icon: "Sparkles" },
  { href: "/ai-voiceover", label: "Voiceover", icon: "Mic" },
  { href: "/media-tools", label: "Media Tools", icon: "Image" },
  { href: "/pdf-tools", label: "PDF Tools", icon: "FileText" },
  { href: "/social-tools", label: "Social Tools", icon: "Share2" },
  { href: "/web-tools", label: "Web Tools", icon: "Globe" },
  { href: "/ai-directory", label: "AI Directory", icon: "LayoutGrid" },
  { href: "/tutorial", label: "Tutorials", icon: "PlayCircle" },
  { href: "/hire-me", label: "Hire Me", icon: "Briefcase" },
  { href: "/blog", label: "Blog", icon: "Newspaper" },
  { href: "/library", label: "Library", icon: "FolderOpen" },
] as const;

export const TOOL_CATEGORIES = [
  { id: "ai", label: "AI Tools", icon: "Sparkles" },
  { id: "image", label: "Image Utilities", icon: "Image" },
  { id: "pdf", label: "PDF Tools", icon: "FileText" },
  { id: "social", label: "Social Tools", icon: "Share2" },
  { id: "web", label: "Web Utilities", icon: "Globe" },
  { id: "text", label: "Text Tools", icon: "Type" },
] as const;

export type ToolCategoryId = (typeof TOOL_CATEGORIES)[number]["id"];
