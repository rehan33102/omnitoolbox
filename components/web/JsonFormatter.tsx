"use client";

import { useMemo, useState } from "react";
import { Braces, CheckCircle2, Copy, Download, Eraser, FileJson, AlertTriangle, ArrowDownUp, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/components/ui/Toast";

const SAMPLE = `{
  "name": "OmniToolBox",
  "version": 1,
  "features": ["format", "minify", "validate"],
  "meta": { "active": true, "visitors": 1250 }
}`;

type Status = { ok: boolean; message: string } | null;

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function describe(value: unknown): { type: string; keys: number; depth: number } {
  let keys = 0;
  let depth = 1;
  const walk = (v: unknown, d: number) => {
    depth = Math.max(depth, d);
    if (Array.isArray(v)) v.forEach((item) => walk(item, d + 1));
    else if (v && typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>);
      keys += entries.length;
      entries.forEach(([, item]) => walk(item, d + 1));
    }
  };
  walk(value, 1);
  return { type: Array.isArray(value) ? "array" : value === null ? "null" : typeof value, keys, depth };
}

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [indent, setIndent] = useState<2 | 4>(2);
  const { copy } = useCopyToClipboard();
  const { toast } = useToast();

  const stats = useMemo(() => {
    if (!output) return null;
    try {
      return describe(JSON.parse(output));
    } catch {
      return null;
    }
  }, [output]);

  function run(mode: "format" | "minify" | "sort" | "validate") {
    if (!input.trim()) {
      setStatus({ ok: false, message: "Paste or type some JSON first." });
      return;
    }
    try {
      const parsed = JSON.parse(input);
      const value = mode === "sort" ? sortDeep(parsed) : parsed;
      if (mode === "validate") {
        setOutput(JSON.stringify(parsed, null, indent));
        setStatus({ ok: true, message: "Valid JSON — no errors found." });
      } else if (mode === "minify") {
        setOutput(JSON.stringify(value));
        setStatus({ ok: true, message: "Minified successfully." });
      } else {
        setOutput(JSON.stringify(value, null, indent));
        setStatus({ ok: true, message: mode === "sort" ? "Keys sorted A–Z at every level." : "Formatted successfully." });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON.";
      setOutput("");
      setStatus({ ok: false, message });
    }
  }

  function download() {
    if (!output) return;
    const blob = new Blob([output], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formatted.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded formatted.json", variant: "success" });
  }

  function loadFile(file: File) {
    file.text().then((text) => {
      setInput(text);
      setStatus(null);
      setOutput("");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Braces className="w-5 h-5" /> JSON Formatter &amp; Validator
          </span>
          <span className="text-xs text-zinc-500">Runs entirely in your browser — your JSON never leaves this device.</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setInput(SAMPLE)}>Load sample</Button>
            <label className="cursor-pointer px-4 py-2 text-xs rounded-full glass font-semibold hover:bg-black/5 dark:hover:bg-white/10">
              Upload .json
              <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">INPUT JSON</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Paste JSON here, e.g. {"name": "OmniToolBox"}'
              spellCheck={false}
              className="w-full h-72 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-500/50 resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">OUTPUT</label>
            <textarea
              value={output}
              readOnly
              placeholder="Formatted JSON appears here"
              spellCheck={false}
              className="w-full h-72 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4 font-mono text-sm outline-none resize-y"
            />
          </div>
        </div>

        {status && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${status.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
            {status.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="font-mono text-xs sm:text-sm break-words">{status.message}</span>
          </div>
        )}

        {stats && (
          <p className="mt-3 text-xs text-zinc-500">
            Result: {stats.type} · {stats.keys} keys · depth {stats.depth} · {new Blob([output]).size.toLocaleString()} bytes
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => run("format")}><Sparkles className="w-4 h-4 mr-1" /> Format</Button>
          <Button variant="secondary" size="sm" onClick={() => run("minify")}><FileJson className="w-4 h-4 mr-1" /> Minify</Button>
          <Button variant="secondary" size="sm" onClick={() => run("validate")}><CheckCircle2 className="w-4 h-4 mr-1" /> Validate</Button>
          <Button variant="secondary" size="sm" onClick={() => run("sort")}><ArrowDownUp className="w-4 h-4 mr-1" /> Sort keys</Button>
          <label className="inline-flex items-center gap-2 text-xs font-medium ml-1">
            Indent
            <select value={indent} onChange={(e) => setIndent(Number(e.target.value) as 2 | 4)} className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-xs outline-none">
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
            </select>
          </label>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" disabled={!output} onClick={() => copy(output, "Formatted JSON copied")}><Copy className="w-4 h-4 mr-1" /> Copy</Button>
          <Button variant="ghost" size="sm" disabled={!output} onClick={download}><Download className="w-4 h-4 mr-1" /> Download</Button>
          <Button variant="ghost" size="sm" onClick={() => { setInput(""); setOutput(""); setStatus(null); }}><Eraser className="w-4 h-4 mr-1" /> Clear</Button>
        </div>
      </Card>
    </div>
  );
}
