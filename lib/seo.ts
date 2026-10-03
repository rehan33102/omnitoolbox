import type { Metadata } from "next";
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

export function buildMetadata({ title, description, path = "/", keywords = [], image, noIndex }: PageMeta): Metadata {
  const url = serverSiteUrl(path);
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: image ? [{ url: serverSiteUrl(image), width: 1200, height: 630 }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [serverSiteUrl(image)] : undefined },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
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
