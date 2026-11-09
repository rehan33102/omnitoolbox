/**
 * Text Diff engine — pure functions, no React, no network.
 * Line-level LCS diff, with word-level highlighting inside changed line pairs.
 * Runs entirely client-side; used by the Text Diff Checker tool.
 */

export type DiffOptions = {
  /** Compare lines case-insensitively. */
  ignoreCase?: boolean;
  /** Ignore leading/trailing whitespace (and collapse inner runs) when comparing. */
  ignoreWhitespace?: boolean;
};

export type DiffToken = {
  type: "same" | "add" | "del";
  text: string;
};

export type DiffLine = {
  type: "same" | "add" | "del";
  /** Original line text (empty string for pure additions is never the case — additions carry their own text). */
  text: string;
  /** Word-level breakdown, present when a removed line was paired with an added line. */
  words?: DiffToken[];
};

export type DiffStats = {
  linesAdded: number;
  linesRemoved: number;
  linesUnchanged: number;
  wordsAdded: number;
  wordsRemoved: number;
  /** 0–100, based on unchanged lines over the larger side. */
  similarity: number;
};

export type DiffResult = {
  lines: DiffLine[];
  stats: DiffStats;
};

/** Hard caps so a pasted novel can't freeze the tab (DP is O(n*m)). */
export const MAX_CHARS = 100_000;
export const MAX_LINES = 4_000;

function compareKey(line: string, opts: DiffOptions): string {
  let k = line;
  if (opts.ignoreWhitespace) k = k.trim().replace(/\s+/g, " ");
  if (opts.ignoreCase) k = k.toLowerCase();
  return k;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Split a line into word / whitespace tokens, keeping every character. */
function tokenize(line: string): string[] {
  return line.match(/\S+|\s+/g) ?? [];
}

/**
 * Generic LCS alignment over two arrays of comparable keys.
 * Returns a list of ops: { type: "same"|"add"|"del", a?: number, b?: number }.
 * Falls back to "everything removed + everything added" when the DP table
 * would be too large.
 */
function lcsAlign<T>(a: T[], b: T[], key: (v: T) => string): { type: "same" | "add" | "del"; a?: number; b?: number }[] {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];
  if (n * m > 16_000_000) {
    return [
      ...a.map((_, i) => ({ type: "del" as const, a: i })),
      ...b.map((_, j) => ({ type: "add" as const, b: j })),
    ];
  }
  const ka = a.map(key);
  const kb = b.map(key);
  // Full DP table (Uint32) so we can backtrack. Bounded by the guard above.
  const dp = new Uint32Array((n + 1) * (m + 1));
  const W = m + 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * W + j] =
        ka[i] === kb[j] ? dp[(i + 1) * W + (j + 1)] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + (j + 1)]);
    }
  }
  const ops: { type: "same" | "add" | "del"; a?: number; b?: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) {
      ops.push({ type: "same", a: i, b: j });
      i++;
      j++;
    } else if (dp[(i + 1) * W + j] >= dp[i * W + (j + 1)]) {
      ops.push({ type: "del", a: i });
      i++;
    } else {
      ops.push({ type: "add", b: j });
      j++;
    }
  }
  while (i < n) ops.push({ type: "del", a: i++ });
  while (j < m) ops.push({ type: "add", b: j++ });
  return ops;
}

/** Word-level diff between two lines, for inline highlighting. */
function diffWords(oldLine: string, newLine: string, opts: DiffOptions): DiffToken[] {
  const a = tokenize(oldLine);
  const b = tokenize(newLine);
  const keyFn = (t: string) => {
    let k = t;
    if (opts.ignoreCase) k = k.toLowerCase();
    return k;
  };
  const ops = lcsAlign(a, b, keyFn);
  return ops.map((op) => ({
    type: op.type,
    text: op.type === "add" ? b[op.b!] : a[op.a!],
  }));
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r\n|\r|\n/);
  // A trailing newline creates a phantom empty last line — drop it.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function diffTexts(oldText: string, newText: string, opts: DiffOptions = {}): DiffResult {
  const aLines = splitLines(oldText).slice(0, MAX_LINES);
  const bLines = splitLines(newText).slice(0, MAX_LINES);
  const ops = lcsAlign(aLines, bLines, (l) => compareKey(l, opts));

  const lines: DiffLine[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === "same") {
      lines.push({ type: "same", text: aLines[op.a!] });
      i++;
      continue;
    }
    // Collect a run of dels followed by adds (or vice versa) and pair them
    // one-to-one so changed lines get word-level highlighting.
    const dels: number[] = [];
    const adds: number[] = [];
    while (i < ops.length && ops[i].type !== "same") {
      if (ops[i].type === "del") dels.push(ops[i].a!);
      else adds.push(ops[i].b!);
      i++;
    }
    const pairs = Math.min(dels.length, adds.length);
    for (let p = 0; p < pairs; p++) {
      const oldLine = aLines[dels[p]];
      const newLine = bLines[adds[p]];
      const words = diffWords(oldLine, newLine, opts);
      // If the word diff shows the lines are actually identical (only
      // whitespace/case differed and the option ignores it), keep it simple.
      const changed = words.some((w) => w.type !== "same");
      lines.push({ type: "del", text: oldLine, words: changed ? words.filter((w) => w.type !== "add") : undefined });
      lines.push({ type: "add", text: newLine, words: changed ? words.filter((w) => w.type !== "del") : undefined });
    }
    for (let p = pairs; p < dels.length; p++) lines.push({ type: "del", text: aLines[dels[p]] });
    for (let p = pairs; p < adds.length; p++) lines.push({ type: "add", text: bLines[adds[p]] });
  }

  let linesAdded = 0;
  let linesRemoved = 0;
  let linesUnchanged = 0;
  let wordsAdded = 0;
  let wordsRemoved = 0;
  // Whitespace-only tokens are alignment artifacts of an inserted word
  // ("single " brings its trailing space) — never count them as words.
  const isWord = (w: { type: string; text: string }) => w.text.trim() !== "";
  for (const l of lines) {
    if (l.type === "add") {
      linesAdded++;
      wordsAdded += l.words ? l.words.filter((w) => w.type === "add" && isWord(w)).length : countWords(l.text);
    } else if (l.type === "del") {
      linesRemoved++;
      wordsRemoved += l.words ? l.words.filter((w) => w.type === "del" && isWord(w)).length : countWords(l.text);
    } else {
      linesUnchanged++;
    }
  }
  const bigger = Math.max(aLines.length, bLines.length);
  const similarity = bigger === 0 ? 100 : Math.round((linesUnchanged / bigger) * 100);

  return { lines, stats: { linesAdded, linesRemoved, linesUnchanged, wordsAdded, wordsRemoved, similarity } };
}

/** Plain-text rendering of a diff, for copy / download. */
export function diffToPlainText(result: DiffResult): string {
  const out: string[] = [
    `Text diff — ${result.stats.linesAdded} line(s) added, ${result.stats.linesRemoved} removed, ${result.stats.linesUnchanged} unchanged, ${result.stats.similarity}% similar`,
    "",
  ];
  for (const l of result.lines) {
    const prefix = l.type === "add" ? "+ " : l.type === "del" ? "- " : "  ";
    out.push(prefix + l.text);
  }
  return out.join("\n");
}
