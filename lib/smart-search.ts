import type { Tool } from "@/types";

export interface SearchHit {
  tool: Tool;
  score: number;
}

const norm = (s: string) => s.toLowerCase().trim();

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
  if (token.length < 3) return 0;
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

  for (const tool of tools) {
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
  for (const tool of tools) {
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
