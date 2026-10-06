import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { SITE_NAME } from "./constants";

/** Production domain — last-resort fallback so SEO output never says localhost. */
const PROD_URL = "https://omnitoolbox-zeta.vercel.app";

/**
 * Server-only base URL for all SEO output (canonicals, sitemap, robots, JSON-LD).
 * 1. NEXT_PUBLIC_SITE_URL env var, when the owner sets it
 * 2. The real request host (Vercel sends x-forwarded-host automatically)
 * 3. Hardcoded production domain — production never emits localhost
 */
export function serverSiteUrl(path = ""): string {
  const clean = (u: string) => `${u.replace(/\/$/, "")}${path}`;
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return clean(env);
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      if (host.includes("localhost") || host.startsWith("127.")) return `http://${host}${path}`;
      const proto = h.get("x-forwarded-proto") ?? "https";
      return `${proto}://${host}${path}`;
    }
  } catch {
    /* statically prerendered — fall through to the production domain */
  }
  return clean(PROD_URL);
}

interface PageMeta {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
}

/* ------------------------------------------------------------------ */
/* Admin-managed SEO settings (KV `seo_settings` table, cached).       */
/* Defaults + per-page overrides are applied live by buildMetadata().  */
/* The KV read is lazy (dynamic import) so lib/seo never pulls the     */
/* service-role client into a static import graph.                     */
/* ------------------------------------------------------------------ */

export interface SeoDefaults {
  titleTemplate: string; // e.g. "%s | Omni Tool Box" — %s = page title
  description: string; // fallback when a page has no description
  ogImage: string; // fallback OG image path/URL
  twitterCard: "summary" | "summary_large_image";
}

export interface SeoOverride {
  path: string; // exact route, e.g. "/calculators"
  title: string;
  description: string;
  ogImage: string;
}

interface SeoConfig {
  defaults: SeoDefaults;
  overrides: SeoOverride[];
}

const DEFAULTS_FALLBACK: SeoDefaults = {
  titleTemplate: "",
  description: "",
  ogImage: "",
  twitterCard: "summary_large_image",
};

let cfgCache: { ts: number; data: SeoConfig } | null = null;
const CFG_TTL_MS = 60_000; // cross-request in-memory cache

async function loadSeoConfig(): Promise<SeoConfig> {
  const now = Date.now();
  if (cfgCache && now - cfgCache.ts < CFG_TTL_MS) return cfgCache.data;
  let defaults: Partial<SeoDefaults> = {};
  let overrides: SeoOverride[] = [];
  try {
    const { getKV } = await import("./kv");
    const [d, o] = await Promise.all([
      getKV<Partial<SeoDefaults>>("seo_defaults", {}),
      getKV<SeoOverride[]>("seo_overrides", []),
    ]);
    if (d && typeof d === "object") defaults = d;
    if (Array.isArray(o)) overrides = o;
  } catch {
    /* DB unreachable (e.g. during build) — fall back to page-level values */
  }
  const data: SeoConfig = {
    defaults: {
      titleTemplate: typeof defaults.titleTemplate === "string" ? defaults.titleTemplate : "",
      description: typeof defaults.description === "string" ? defaults.description : "",
      ogImage: typeof defaults.ogImage === "string" ? defaults.ogImage : "",
      twitterCard: defaults.twitterCard === "summary" ? "summary" : "summary_large_image",
    },
    overrides: overrides.filter((o) => o && typeof o.path === "string"),
  };
  cfgCache = { ts: now, data };
  return data;
}

/** Per-request dedupe on top of the TTL cache. */
const getSeoConfig = cache(loadSeoConfig);

const normPath = (p: string) => (p === "" ? "/" : p || "/");

/** Resolve an OG image: absolute URLs pass through, paths get the site origin. */
const resolveImage = (img: string | undefined) =>
  img && /^https?:\/\//i.test(img) ? img : img ? serverSiteUrl(img) : img;

export async function buildMetadata({ title, description, path = "/", keywords = [], image, noIndex }: PageMeta): Promise<Metadata> {
  const cfg = await getSeoConfig();

  // 1. Per-page overrides win over everything (exact path match).
  const ov = cfg.overrides.find((o) => normPath(o.path) === normPath(path));
  let t = ov?.title?.trim() ? ov.title.trim() : title;
  let d = ov?.description?.trim() ? ov.description.trim() : description;
  let img = ov?.ogImage?.trim() ? ov.ogImage.trim() : image;

  // 2. Global defaults fill the gaps.
  const def = cfg.defaults;
  if (def.titleTemplate.includes("%s") && t && !t.includes(SITE_NAME)) {
    t = def.titleTemplate.replace("%s", t);
  }
  if (!d && def.description) d = def.description;
  if (!img && def.ogImage) img = def.ogImage;

  // 3. Ultimate fallback: the auto-generated OG image route, so NO page
  // ever ships without an og:image (this was the SEO audit's red-X cause).
  if (!img) img = "/opengraph-image";

  const url = serverSiteUrl(path);
  const imgUrl = resolveImage(img);
  return {
    title: t,
    description: d,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: t,
      description: d,
      url,
      images: imgUrl ? [{ url: imgUrl, width: 1200, height: 630 }] : undefined,
    },
    twitter: { card: def.twitterCard, title: t, description: d, images: imgUrl ? [imgUrl] : undefined },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: serverSiteUrl(),
    logo: serverSiteUrl("/icons/icon-512.png"),
    sameAs: [],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: serverSiteUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: `${serverSiteUrl()}/?q={query}`,
      "query-input": "required name=query",
    },
  };
}

export function softwareAppJsonLd(opts: { name: string; description: string; url: string; category?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    ...(opts.category ? { applicationSubCategory: opts.category } : {}),
  };
}

export function articleJsonLd(post: { title: string; excerpt: string; slug: string; publishedAt: string | null; updatedAt: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    url: serverSiteUrl(`/blog/${post.slug}`),
    datePublished: post.publishedAt ?? post.updatedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: serverSiteUrl(item.path),
    })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
