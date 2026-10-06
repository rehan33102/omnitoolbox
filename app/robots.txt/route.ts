import { NextResponse } from "next/server";
import { serverSiteUrl } from "@/lib/seo";
import { getKV } from "@/lib/kv";

export const revalidate = 3600;

const DISALLOW = [
  "/admin/",
  "/api/admin/",
  "/api/analytics/",
  "/api/auth/",
  "/dashboard",
  "/login",
  "/signup",
  "/auth",
];

function defaultRobots(): string {
  const lines = ["User-agent: *", "Allow: /"];
  for (const d of DISALLOW) lines.push(`Disallow: ${d}`);
  lines.push("", `Sitemap: ${serverSiteUrl("/sitemap.xml")}`);
  return lines.join("\n");
}

/**
 * Serves /robots.txt as raw text.
 * When the admin has saved custom rules (KV `seo_robots.rules`), those are
 * served verbatim; otherwise the built-in default above is used.
 */
export async function GET() {
  let body = defaultRobots();
  try {
    const custom = await getKV<{ rules?: string } | null>("seo_robots", null);
    if (custom?.rules?.trim()) body = custom.rules.trim();
  } catch {
    /* DB unreachable — serve the default */
  }
  return new NextResponse(body + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
