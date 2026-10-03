import type { MetadataRoute } from "next";
import { serverSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/admin/", "/api/analytics/", "/login", "/signup"],
      },
    ],
    sitemap: serverSiteUrl("/sitemap.xml"),
    host: serverSiteUrl().replace(/^https?:\/\//, ""),
  };
}
