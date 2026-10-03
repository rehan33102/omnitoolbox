export type ToolCategory = "ai" | "image" | "social" | "web" | "text" | "pdf";

export interface Tool {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  href: string;
  icon: string;
  badge?: "new" | "popular" | "pro";
  enabled: boolean;
  sortOrder: number;
  usageCount: number;
  updatedAt: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  readingMinutes: number;
  publishedAt: string | null;
  updatedAt: string;
}

export interface AIToolListing {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  affiliateUrl?: string;
  category: string;
  tags: string[];
  votes: number;
  featured: boolean;
  createdAt: string;
}

export type AdType = "adsense" | "banner" | "affiliate";

export interface AdConfig {
  id: string;
  placement: string;
  type: AdType;
  slotId?: string;
  imageUrl?: string;
  linkUrl?: string;
  html?: string;
  enabled: boolean;
}

export interface Profile {
  id: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}
