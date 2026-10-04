import type { Tool } from "@/types";

export interface SearchHit {
  tool: Tool;
  score: number;
}

const norm = (s: string) => s.toLowerCase().trim();

/** Site pages (non-tool) that should also appear in search results. */
const SITE_PAGES: Tool[] = [
  {
    id: "page-blog", slug: "page-blog", title: "Blog",
    tagline: "Articles, guides and tips",
    description: "Read our latest articles, tutorials and guides.",
    category: "web", href: "/blog", icon: "newspaper",
    keywords: ["blog", "articles", "news", "guides", "tips", "posts"],
    enabled: true, sortOrder: 900, usageCount: 0, updatedAt: "",
  },
  {
    id: "page-library", slug: "page-library", title: "Library",
    tagline: "Your saved creations",
    description: "Everything you created — voiceovers, images, QR codes — saved here.",
    category: "web", href: "/library", icon: "folder",
    keywords: ["library", "saved", "history", "my files", "creations"],
    enabled: true, sortOrder: 901, usageCount: 0, updatedAt: "",
  },
  {
    id: "page-contact", slug: "page-contact", title: "Contact",
    tagline: "Get in touch with us",
    description: "Contact us for feedback, support or suggestions.",
    category: "web", href: "/contact", icon: "mail",
    keywords: ["contact", "support", "help", "feedback", "email"],
    enabled: true, sortOrder: 902, usageCount: 0, updatedAt: "",
  },
  {
    id: "page-ai-directory", slug: "page-ai-directory", title: "AI Tools Directory",
    tagline: "Discover the best AI tools",
    description: "A curated directory of the best AI tools on the internet.",
    category: "ai", href: "/ai-directory", icon: "sparkles",
    keywords: ["ai directory", "directory", "ai tools list", "best ai"],
    enabled: true, sortOrder: 903, usageCount: 0, updatedAt: "",
  },
];

/** Field weights — title match beats keyword match beats description match. */
const W_TITLE = 3;
const W_KEYWORD = 2.5;
const W_TAGLINE = 2;
const W_DESC = 1;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Score a single query token against a field (0..1).
 * Whole-word hit = 1 (short tokens MUST be whole words, so "age" doesn't
 * match "image" and "unit" doesn't match "community"); longer tokens may
 * match as substrings ("voice" -> "voiceover"); otherwise a fuzzy
 * word-level similarity tolerates typos ("pasword" -> "password").
 */
function tokenFieldScore(token: string, field: string): number {
  const f = norm(field);
  if (!f || !token) return 0;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`).test(f)) return 1;
  if (token.length > 4 && f.includes(token)) return 1;
  // Short tokens (1-2 chars): prefix match — "a" matches titles starting with "a"
  // so single-letter search shows all tools starting with that letter.
  if (token.length < 3) {
    const words = f.split(/[^a-z0-9]+/).filter(Boolean);
    for (const word of words) {
      if (word.startsWith(token)) return 0.9;
    }
    return 0;
  }
  let best = 0;
  for (const word of f.split(/[^a-z0-9]+/)) {
    if (!word || Math.abs(word.length - token.length) > 3) continue;
    const sim = 1 - levenshtein(token, word) / Math.max(token.length, word.length);
    if (sim > best) best = sim;
  }
  return best >= 0.66 ? best * 0.8 : 0;
}

/**
 * Smart search across title + tagline + description + keyword aliases.
 * Every query token must match somewhere; results are ranked by
 * weighted score (title > keywords > tagline > description).
 */
export function smartSearch(tools: Tool[], rawQuery: string, limit = 8): SearchHit[] {
  const q = norm(rawQuery);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  // Search tools AND site pages (blog, library, contact...)
  const all = [...tools, ...SITE_PAGES];

  for (const tool of all) {
    if (!tool.enabled) continue;
    const keywords = (tool.keywords ?? []).join(" ");
    let total = 0;
    let ok = true;
    for (const token of tokens) {
      const best = Math.max(
        tokenFieldScore(token, tool.title) * W_TITLE,
        tokenFieldScore(token, keywords) * W_KEYWORD,
        tokenFieldScore(token, tool.tagline) * W_TAGLINE,
        tokenFieldScore(token, tool.description) * W_DESC
      );
      if (best <= 0) {
        ok = false;
        break;
      }
      total += best;
    }
    if (ok) {
      // Bonus when the whole query matches a keyword alias exactly
      // ("photo maker" -> Background Remover beats "photo pdf maker").
      const kwList = (tool.keywords ?? []).map(norm);
      let bonus = 0;
      for (const kw of kwList) {
        if (kw === q) {
          bonus = 6;
          break;
        }
        if (q.length >= 4 && kw.includes(q)) bonus = Math.max(bonus, 3);
      }
      // A-to-Z prefix boost: typing "a" surfaces tools STARTING with "a" first.
      // ("a" -> "AI Voiceover" before "Background Remover" which merely contains "a")
      const titleNorm = norm(tool.title);
      if (titleNorm.startsWith(q)) {
        bonus += 10 + (20 / (1 + titleNorm.length)); // shorter titles rank slightly higher
      } else {
        // word-boundary prefix: "voice" matches "AI Voiceover" at word start
        const words = titleNorm.split(/\s+/);
        if (words.some((w) => w.startsWith(q))) bonus += 5;
      }
      hits.push({ tool, score: total + bonus });
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || a.tool.sortOrder - b.tool.sortOrder)
    .slice(0, limit);
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (b.includes(a) || a.includes(b)) return 0.92;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

/**
 * "Did you mean / Alternatives" — closest tools by keyword/title
 * similarity when nothing matches exactly.
 */
export function findAlternatives(tools: Tool[], rawQuery: string, limit = 3): SearchHit[] {
  const q = norm(rawQuery);
  if (!q || q.length < 2) return [];
  const scored: SearchHit[] = [];
  const all = [...tools, ...SITE_PAGES];
  for (const tool of all) {
    if (!tool.enabled) continue;
    let best = 0;
    for (const c of [tool.title, ...(tool.keywords ?? [])]) {
      const s = similarity(q, norm(c));
      if (s > best) best = s;
    }
    if (best >= 0.32) scored.push({ tool, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
