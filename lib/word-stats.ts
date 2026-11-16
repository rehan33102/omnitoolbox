/**
 * Word-count + readability analysis for the Word Counter tool.
 * Pure functions, no I/O — everything runs client-side.
 *
 * Readability uses the standard Flesch formulas:
 *   Reading Ease = 206.835 − 1.015·(words/sentences) − 84.6·(syllables/words)
 *   Kincaid Grade = 0.39·(words/sentences) + 11.8·(syllables/words) − 15.59
 * Syllables are counted with the usual vowel-group heuristic (silent-e
 * handling, minimum 1 per word). Scores are null when the text is too
 * short to be meaningful (< 10 words).
 */

export const MAX_CHARS = 100_000;

export interface TopWord {
  word: string;
  count: number;
  /** Share of all words, in percent. */
  pct: number;
}

export interface WordStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  syllables: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  /** Minutes at 200 wpm (average adult reading speed). */
  readingMinutes: number;
  /** Minutes at 130 wpm (average speaking speed). */
  speakingMinutes: number;
  fleschReadingEase: number | null;
  fleschKincaidGrade: number | null;
  readabilityLabel: string;
  topWords: TopWord[];
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when",
  "while", "of", "at", "by", "for", "with", "about", "against", "between",
  "into", "through", "during", "before", "after", "above", "below", "to",
  "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
  "further", "once", "here", "there", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just",
  "should", "now", "is", "am", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having", "do", "does", "did", "doing", "would",
  "shall", "could", "may", "might", "must", "i", "you", "he", "she", "it",
  "we", "they", "me", "him", "her", "us", "them", "my", "your", "his",
  "its", "our", "their", "this", "that", "these", "those", "who", "whom",
  "which", "what", "as", "are", "is", "was", "were", "also", "per", "via",
]);

/** Count syllables in a single word with the standard vowel-group heuristic. */
export function countSyllables(raw: string): number {
  const word = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;
  // Drop a trailing silent "e" (but keep "-le" endings like "table").
  let w = word;
  if (w.endsWith("e") && !w.endsWith("le")) w = w.slice(0, -1);
  // Drop a trailing "-ed" that adds no syllable ("walked" vs "wanted").
  if (w.endsWith("ed") && w.length > 3 && !/[td]ed$/.test(w)) w = w.slice(0, -2);
  const groups = w.match(/[aeiouy]+/g);
  const count = groups ? groups.length : 0;
  return Math.max(1, count);
}

export function fleschLabel(score: number): string {
  if (score >= 90) return "Very easy to read";
  if (score >= 80) return "Easy to read";
  if (score >= 70) return "Fairly easy to read";
  if (score >= 60) return "Standard — plain English";
  if (score >= 50) return "Fairly difficult to read";
  if (score >= 30) return "Difficult to read";
  return "Very difficult to read";
}

function splitWords(text: string): string[] {
  return text
    .split(/[\s—–-]+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, ""))
    .filter((w) => w.length > 0);
}

export function analyzeText(text: string): WordStats {
  const words = splitWords(text);
  const wordCount = words.length;

  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;

  // Sentences end on . ! ? (including multiples like "..." or "?!").
  // A fragment with no terminator still counts as one sentence.
  const terminators = text.match(/[.!?]+(?=\s|$)/g);
  const sentences =
    wordCount === 0 ? 0 : terminators ? terminators.length : 1;

  const paragraphs =
    wordCount === 0
      ? 0
      : text
          .split(/\n\s*\n/)
          .filter((p) => p.trim().length > 0).length || 1;

  let syllables = 0;
  const freq = new Map<string, number>();
  for (const w of words) {
    syllables += countSyllables(w);
    const key = w.toLowerCase().replace(/[^a-z0-9']/g, "");
    if (key.length >= 3 && !STOPWORDS.has(key)) {
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }

  const avgWordsPerSentence =
    sentences > 0 ? wordCount / sentences : 0;
  const avgSyllablesPerWord =
    wordCount > 0 ? syllables / wordCount : 0;

  const meaningful = wordCount >= 10 && sentences > 0;
  const fleschReadingEase = meaningful
    ? Math.round(
        (206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord) *
          10,
      ) / 10
    : null;
  const fleschKincaidGrade = meaningful
    ? Math.round(
        (0.39 * avgWordsPerSentence +
          11.8 * avgSyllablesPerWord -
          15.59) *
          10,
      ) / 10
    : null;

  const topWords: TopWord[] = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      pct: Math.round((count / wordCount) * 1000) / 10,
    }));

  return {
    words: wordCount,
    characters,
    charactersNoSpaces,
    sentences,
    paragraphs,
    syllables,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    readingMinutes: wordCount / 200,
    speakingMinutes: wordCount / 130,
    fleschReadingEase,
    fleschKincaidGrade,
    readabilityLabel:
      fleschReadingEase === null
        ? "Add at least 10 words for a readability score"
        : fleschLabel(fleschReadingEase),
    topWords,
  };
}

/** Plain-text report of the stats, for copy / download. */
export function statsToPlainText(text: string, stats: WordStats): string {
  const lines = [
    "Word Counter — OmniToolBox",
    "",
    `Words: ${stats.words}`,
    `Characters: ${stats.characters} (${stats.charactersNoSpaces} without spaces)`,
    `Sentences: ${stats.sentences}`,
    `Paragraphs: ${stats.paragraphs}`,
    `Syllables: ${stats.syllables}`,
    `Average words per sentence: ${stats.avgWordsPerSentence}`,
    `Average syllables per word: ${stats.avgSyllablesPerWord}`,
    `Reading time: ${formatMinutes(stats.readingMinutes)}`,
    `Speaking time: ${formatMinutes(stats.speakingMinutes)}`,
  ];
  if (stats.fleschReadingEase !== null) {
    lines.push(
      `Flesch Reading Ease: ${stats.fleschReadingEase} (${stats.readabilityLabel})`,
      `Flesch-Kincaid Grade Level: ${stats.fleschKincaidGrade}`,
    );
  }
  if (stats.topWords.length > 0) {
    lines.push("", "Most frequent words:");
    for (const t of stats.topWords) {
      lines.push(`  ${t.word}: ${t.count} (${t.pct}%)`);
    }
  }
  lines.push("", "--- Text ---", text);
  return lines.join("\n");
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) {
    const seconds = Math.max(1, Math.round(minutes * 60));
    return `~${seconds} sec`;
  }
  if (minutes < 60) {
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return s === 0 ? `~${m} min` : `~${m} min ${s} sec`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `~${h} hr ${m} min`;
}
