import type { MetadataRoute } from "next";
import { serverSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/admin/", "/api/analytics/", "/api/auth/", "/dashboard", "/login", "/signup", "/auth"],
      },
    ],
    sitemap: serverSiteUrl("/sitemap.xml"),
    host: serverSiteUrl().replace(/^https?:\/\//, ""),
  };
}
