"use client";

import { useMemo, useState } from "react";
import { GitCompareArrows, CheckCircle2, Copy, Download, Eraser, ArrowLeftRight, FileText, AlertTriangle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/components/ui/Toast";
import { diffTexts, diffToPlainText, MAX_CHARS, type DiffLine } from "@/lib/text-diff";

const SAMPLE_OLD = `The quick brown fox jumps over the lazy dog.
OmniToolBox helps you work faster every day.
Paste two versions of any text to spot every change.
Writers use it to check edits before publishing.`;

const SAMPLE_NEW = `The quick brown fox leaps over the lazy dog.
OmniToolBox helps you work smarter every single day.
Paste two versions of any text to spot every single change.
Editors use it to check revisions before publishing.
A brand new line was added at the end.`;

type ToastFn = ReturnType<typeof useToast>["toast"];

function setClamped(setter: (v: string) => void, value: string, toast: ToastFn) {
  if (value.length > MAX_CHARS) {
    setter(value.slice(0, MAX_CHARS));
    toast({ title: `Text limited to ${MAX_CHARS.toLocaleString()} characters per side.`, variant: "error" });
  } else {
    setter(value);
  }
}

function DiffLineRow({ line, index }: { line: DiffLine; index: number }) {
  const bg =
    line.type === "add"
      ? "bg-emerald-500/10"
      : line.type === "del"
        ? "bg-red-500/10"
        : "";
  const marker = line.type === "add" ? "+" : line.type === "del" ? "−" : " ";
  const markerColor =
    line.type === "add"
      ? "text-emerald-600 dark:text-emerald-400"
      : line.type === "del"
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-400";
  return (
    <div className={`flex gap-3 px-3 py-1 font-mono text-[13px] leading-6 ${bg}`}>
      <span className="w-8 shrink-0 text-right text-zinc-400 select-none">{index + 1}</span>
      <span className={`w-4 shrink-0 text-center font-bold select-none ${markerColor}`}>{marker}</span>
      <span className="whitespace-pre-wrap break-words flex-1">
        {line.words
          ? line.words.map((w, i) =>
              w.type === "same" ? (
                <span key={i}>{w.text}</span>
              ) : (
                <span
                  key={i}
                  className={
                    w.type === "add"
                      ? "bg-emerald-500/30 text-emerald-900 dark:text-emerald-100 rounded px-0.5"
                      : "bg-red-500/30 text-red-900 dark:text-red-100 rounded px-0.5 line-through"
                  }
                >
                  {w.text}
                </span>
              ),
            )
          : line.text === ""
            ? "\u00a0"
            : line.text}
      </span>
    </div>
  );
}

export default function TextDiffChecker() {
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const { copy } = useCopyToClipboard();
  const { toast } = useToast();

  const result = useMemo(() => {
    if (!oldText && !newText) return null;
    return diffTexts(oldText, newText, { ignoreCase, ignoreWhitespace });
  }, [oldText, newText, ignoreCase, ignoreWhitespace]);

  const hasInput = oldText.trim() !== "" || newText.trim() !== "";
  const identical =
    result !== null &&
    result.stats.linesAdded === 0 &&
    result.stats.linesRemoved === 0;

  function loadFile(file: File, side: "old" | "new") {
    file.text().then((text) => {
      if (side === "old") setClamped(setOldText, text, toast);
      else setClamped(setNewText, text, toast);
    });
  }

  function swap() {
    setOldText(newText);
    setNewText(oldText);
  }

  function clear() {
    setOldText("");
    setNewText("");
  }

  function loadSample() {
    setOldText(SAMPLE_OLD);
    setNewText(SAMPLE_NEW);
  }

  function download() {
    if (!result) return;
    const blob = new Blob([diffToPlainText(result)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "text-diff.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded text-diff.txt", variant: "success" });
  }

  const stats = result?.stats;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <GitCompareArrows className="w-5 h-5" /> Text Diff Checker
          </span>
          <span className="text-xs text-zinc-500">Runs entirely in your browser — your text never leaves this device.</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadSample}>Load sample</Button>
            <Button variant="ghost" size="sm" onClick={swap} disabled={!hasInput}>
              <ArrowLeftRight className="w-4 h-4 mr-1" /> Swap
            </Button>
            <Button variant="ghost" size="sm" onClick={clear} disabled={!hasInput}>
              <Eraser className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-zinc-500">ORIGINAL TEXT</label>
              <label className="cursor-pointer text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                Upload .txt
                <input type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f, "old"); e.target.value = ""; }} />
              </label>
            </div>
            <textarea
              value={oldText}
              onChange={(e) => setClamped(setOldText, e.target.value, toast)}
              placeholder={"Paste the original version here…"}
              spellCheck={false}
              className="w-full h-64 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-500/50 resize-y"
            />
            <p className="mt-1 text-xs text-zinc-500">{oldText.length.toLocaleString()} characters</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-zinc-500">REVISED TEXT</label>
              <label className="cursor-pointer text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                Upload .txt
                <input type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f, "new"); e.target.value = ""; }} />
              </label>
            </div>
            <textarea
              value={newText}
              onChange={(e) => setClamped(setNewText, e.target.value, toast)}
              placeholder={"Paste the revised version here…"}
              spellCheck={false}
              className="w-full h-64 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-500/50 resize-y"
            />
            <p className="mt-1 text-xs text-zinc-500">{newText.length.toLocaleString()} characters</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /> Ignore case
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input type="checkbox" checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.target.checked)} /> Ignore whitespace changes
          </label>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" disabled={!result} onClick={() => result && copy(diffToPlainText(result), "Diff copied")}>
            <Copy className="w-4 h-4 mr-1" /> Copy diff
          </Button>
          <Button variant="ghost" size="sm" disabled={!result} onClick={download}>
            <Download className="w-4 h-4 mr-1" /> Download .txt
          </Button>
        </div>
      </Card>

      {result && stats && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {identical ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Texts are identical
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-1.5 text-xs font-semibold">
                <FileText className="w-4 h-4" /> {stats.linesAdded} line(s) added · {stats.linesRemoved} removed
              </span>
            )}
            <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 text-xs font-semibold">
              {stats.similarity}% similar
            </span>
            <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 text-xs font-semibold">
              {stats.wordsAdded} word(s) added · {stats.wordsRemoved} removed
            </span>
            <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 text-xs font-semibold">
              {stats.linesUnchanged} line(s) unchanged
            </span>
          </div>

          <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden">
            <div className="max-h-[480px] overflow-auto py-2">
              {result.lines.length === 0 ? (
                <p className="px-4 py-3 text-sm text-zinc-500">Both texts are empty.</p>
              ) : (
                result.lines.map((line, i) => <DiffLineRow key={i} line={line} index={i} />)
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-zinc-500 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            Green lines were added, red lines were removed. Inside a changed line, only the changed words are highlighted.
          </p>
        </Card>
      )}
    </div>
  );
}
