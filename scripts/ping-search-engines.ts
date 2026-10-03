/** Ping search engines after a sitemap regeneration. Run: npx tsx scripts/ping-search-engines.ts */
const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const sitemapUrl = encodeURIComponent(`${base.replace(/\/$/, "")}/sitemap.xml`);

const endpoints = [
  `https://www.google.com/ping?sitemap=${sitemapUrl}`,
  `https://www.bing.com/ping?sitemap=${sitemapUrl}`,
];

async function main() {
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      console.log(`${res.ok ? "OK  " : "FAIL"} ${res.status} — ${url}`);
    } catch (err) {
      console.log(`ERR  — ${url}: ${(err as Error).message}`);
    }
  }
}

main();
