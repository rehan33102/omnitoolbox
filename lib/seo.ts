import type { Metadata } from "next";
import { siteUrl } from "./utils";
import { SITE_NAME } from "./constants";

interface PageMeta {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
}

export function buildMetadata({ title, description, path = "/", keywords = [], image, noIndex }: PageMeta): Metadata {
  const url = siteUrl(path);
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
      images: image ? [{ url: siteUrl(image), width: 1200, height: 630 }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [siteUrl(image)] : undefined },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl()}/?q={query}`,
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
    url: siteUrl(`/blog/${post.slug}`),
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
      item: siteUrl(item.path),
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
