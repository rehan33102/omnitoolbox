export const SITE_NAME = "OmniToolBox";
export const SITE_TAGLINE = "50+ free AI & web utilities. No signup, no lag.";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/ai-prompt-studio", label: "Prompt Studio" },
  { href: "/media-tools", label: "Media Tools" },
  { href: "/social-tools", label: "Social Tools" },
  { href: "/ai-directory", label: "AI Directory" },
  { href: "/blog", label: "Blog" },
] as const;

export const TOOL_CATEGORIES = [
  { id: "ai", label: "AI Tools", icon: "Sparkles" },
  { id: "image", label: "Image Utilities", icon: "Image" },
  { id: "social", label: "Social Tools", icon: "Share2" },
  { id: "web", label: "Web Utilities", icon: "Globe" },
  { id: "text", label: "Text Tools", icon: "Type" },
] as const;

export type ToolCategoryId = (typeof TOOL_CATEGORIES)[number]["id"];
