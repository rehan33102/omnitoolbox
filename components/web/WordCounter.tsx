"use client";

import { useMemo, useState } from "react";
import { WholeWord, Copy, Download, Eraser, FileText, Gauge } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/components/ui/Toast";
import {
  analyzeText,
  formatMinutes,
  statsToPlainText,
  MAX_CHARS,
  type WordStats,
} from "@/lib/word-stats";

const SAMPLE = `The quick brown fox jumps over the lazy dog. Writing clearly is a skill that improves with practice, and every writer benefits from knowing how their words land. Short sentences keep readers moving forward, while long ones can slow them down. Count your words, check your rhythm, and rewrite until the text feels effortless.

Paste your own text above — an essay, a blog draft, a caption, a chapter — and see live counts, reading time and a readability score as you type.`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] px-4 py-3">
      <div className="text-2xl font-extrabold tracking-tight tabular-nums">{value}</div>
      <div className="text-xs font-semibold text-zinc-500 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ReadabilityCard({ stats }: { stats: WordStats }) {
  if (stats.fleschReadingEase === null) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="w-5 h-5" />
          <h2 className="font-semibold">Readability</h2>
        </div>
        <p className="text-sm text-zinc-500">{stats.readabilityLabel}.</p>
      </Card>
    );
  }
  const ease = Math.max(0, Math.min(100, stats.fleschReadingEase));
  const barColor =
    ease >= 70
      ? "bg-emerald-500"
      : ease >= 50
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-5 h-5" />
        <h2 className="font-semibold">Readability</h2>
      </div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <div className="text-4xl font-extrabold tracking-tight tabular-nums">
            {stats.fleschReadingEase}
            <span className="text-lg text-zinc-400 font-semibold"> / 100</span>
          </div>
          <div className="text-xs font-semibold text-zinc-500 mt-1">Flesch Reading Ease</div>
          <div className="text-sm font-medium mt-0.5">{stats.readabilityLabel}</div>
        </div>
        <div>
          <div className="text-4xl font-extrabold tracking-tight tabular-nums">
            {stats.fleschKincaidGrade}
          </div>
          <div className="text-xs font-semibold text-zinc-500 mt-1">Flesch-Kincaid Grade Level</div>
          <div className="text-sm text-zinc-500 mt-0.5">
            Readable by a US grade {Math.max(1, Math.round(stats.fleschKincaidGrade ?? 0))} student
          </div>
        </div>
      </div>
      <div className="mt-4 h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${ease}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
        <span>Very difficult</span>
        <span>Standard</span>
        <span>Very easy</span>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Higher is easier to read. Aim for 60–70 for general audiences and 70+ for
        captions, product pages and social posts.
      </p>
    </Card>
  );
}

export default function WordCounter() {
  const [text, setText] = useState("");
  const { copy } = useCopyToClipboard();
  const { toast } = useToast();

  const stats = useMemo(() => analyzeText(text), [text]);
  const hasInput = text.trim() !== "";

  function onChange(value: string) {
    if (value.length > MAX_CHARS) {
      setText(value.slice(0, MAX_CHARS));
      toast({ title: `Text limited to ${MAX_CHARS.toLocaleString()} characters.`, variant: "error" });
    } else {
      setText(value);
    }
  }

  function loadFile(file: File) {
    file.text().then((t) => onChange(t));
  }

  function download() {
    const blob = new Blob([statsToPlainText(text, stats)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "word-count.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded word-count.txt", variant: "success" });
  }

  const maxTop = Math.max(1, ...stats.topWords.map((t) => t.count));

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <WholeWord className="w-5 h-5" /> Word Counter
          </span>
          <span className="text-xs text-zinc-500">Runs entirely in your browser — your text never leaves this device.</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setText(SAMPLE)}>Load sample</Button>
            <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={!hasInput}>
              <Eraser className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-zinc-500">YOUR TEXT</label>
          <label className="cursor-pointer text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
            Upload .txt
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
            />
          </label>
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste or type your text here — counts update live as you type…"
          spellCheck={false}
          className="w-full h-72 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4 text-sm leading-6 outline-none focus:ring-2 focus:ring-brand-500/50 resize-y"
        />
        <p className="mt-1 text-xs text-zinc-500">
          {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
        </p>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Words" value={stats.words.toLocaleString()} />
          <Stat label="Characters" value={stats.characters.toLocaleString()} sub={`${stats.charactersNoSpaces.toLocaleString()} without spaces`} />
          <Stat label="Sentences" value={stats.sentences.toLocaleString()} sub={`${stats.avgWordsPerSentence} words each on average`} />
          <Stat label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
          <Stat label="Syllables" value={stats.syllables.toLocaleString()} sub={`${stats.avgSyllablesPerWord} per word on average`} />
          <Stat label="Reading time" value={formatMinutes(stats.readingMinutes)} sub="at 200 words per minute" />
          <Stat label="Speaking time" value={formatMinutes(stats.speakingMinutes)} sub="at 130 words per minute" />
          <Stat
            label="Characters per word"
            value={stats.words > 0 ? (stats.charactersNoSpaces / stats.words).toFixed(1) : "0"}
            sub="average word length"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="flex-1" />
          <Button variant="ghost" size="sm" disabled={!hasInput} onClick={() => copy(statsToPlainText(text, stats), "Report copied")}>
            <Copy className="w-4 h-4 mr-1" /> Copy report
          </Button>
          <Button variant="ghost" size="sm" disabled={!hasInput} onClick={download}>
            <Download className="w-4 h-4 mr-1" /> Download .txt
          </Button>
        </div>
      </Card>

      {hasInput && (
        <>
          <ReadabilityCard stats={stats} />

          {stats.topWords.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5" />
                <h2 className="font-semibold">Most frequent words</h2>
                <span className="text-xs text-zinc-500">Common words like &ldquo;the&rdquo; and &ldquo;and&rdquo; are skipped</span>
              </div>
              <ul className="space-y-2">
                {stats.topWords.map((t) => (
                  <li key={t.word} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 font-medium truncate">{t.word}</span>
                    <span className="flex-1 h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${(t.count / maxTop) * 100}%` }}
                      />
                    </span>
                    <span className="w-20 shrink-0 text-right text-zinc-500 tabular-nums">
                      {t.count}× · {t.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
