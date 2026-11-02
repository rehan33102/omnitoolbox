"use client";

import { useState } from "react";
import { Table2, CheckCircle2, Copy, Download, Eraser, AlertTriangle, ArrowRightLeft } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/components/ui/Toast";
import { csvToJson } from "@/lib/csv";

const SAMPLE = `name,city,age,note
"Rehan, Tariq",Karachi,28,"Likes ""quoted"" text"
Ayesha,Lahore,31,New joiner
Bilal,Islamabad,25,"Multi-line
note here"`;

type Status = { ok: boolean; message: string } | null;

export default function CsvToJson() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [autoType, setAutoType] = useState(true);
  const [indent, setIndent] = useState<2 | 4>(2);
  const [stats, setStats] = useState<{ rows: number; columns: number } | null>(null);
  const { copy } = useCopyToClipboard();
  const { toast } = useToast();

  function convert() {
    if (!input.trim()) {
      setStatus({ ok: false, message: "Paste CSV or upload a file first." });
      return;
    }
    try {
      const result = csvToJson(input, { delimiter, hasHeader, autoType });
      setOutput(JSON.stringify(result.data, null, indent));
      setStats({ rows: result.rows, columns: result.columns });
      const warn = result.warnings.length > 0 ? ` ${result.warnings[0]}` : "";
      setStatus({
        ok: true,
        message: `Converted ${result.rows} row(s) × ${result.columns} column(s) to JSON.${warn}`,
      });
    } catch (err) {
      setOutput("");
      setStats(null);
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not parse this CSV." });
    }
  }

  function download() {
    if (!output) return;
    const blob = new Blob([output], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded converted.json", variant: "success" });
  }

  function loadFile(file: File) {
    file.text().then((text) => {
      setInput(text);
      setStatus(null);
      setOutput("");
      setStats(null);
    });
  }

  function clear() {
    setInput("");
    setOutput("");
    setStatus(null);
    setStats(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Table2 className="w-5 h-5" /> CSV to JSON Converter
          </span>
          <span className="text-xs text-zinc-500">Runs entirely in your browser — your data never leaves this device.</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setInput(SAMPLE)}>Load sample</Button>
            <label className="cursor-pointer px-4 py-2 text-xs rounded-full glass font-semibold hover:bg-black/5 dark:hover:bg-white/10">
              Upload .csv
              <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">INPUT CSV</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={'Paste CSV here, e.g.\nname,city\nRehan,Karachi'}
              spellCheck={false}
              className="w-full h-72 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-500/50 resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">OUTPUT JSON</label>
            <textarea
              value={output}
              readOnly
              placeholder="JSON array appears here"
              spellCheck={false}
              className="w-full h-72 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4 font-mono text-sm outline-none resize-y"
            />
          </div>
        </div>

        {status && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${status.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
            {status.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="text-xs sm:text-sm break-words">{status.message}</span>
          </div>
        )}

        {stats && (
          <p className="mt-3 text-xs text-zinc-500">
            Result: {stats.rows} rows · {stats.columns} columns · {new Blob([output]).size.toLocaleString()} bytes
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={convert}><ArrowRightLeft className="w-4 h-4 mr-1" /> Convert to JSON</Button>
          <label className="inline-flex items-center gap-2 text-xs font-medium ml-1">
            Delimiter
            <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-xs outline-none">
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value={"\t"}>Tab</option>
              <option value="|">Pipe (|)</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-medium ml-1">
            Indent
            <select value={indent} onChange={(e) => setIndent(Number(e.target.value) as 2 | 4)} className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-xs outline-none">
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-medium ml-1 cursor-pointer">
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> First row is header
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-medium ml-1 cursor-pointer">
            <input type="checkbox" checked={autoType} onChange={(e) => setAutoType(e.target.checked)} /> Detect numbers &amp; booleans
          </label>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" disabled={!output} onClick={() => copy(output, "JSON copied")}><Copy className="w-4 h-4 mr-1" /> Copy</Button>
          <Button variant="ghost" size="sm" disabled={!output} onClick={download}><Download className="w-4 h-4 mr-1" /> Download</Button>
          <Button variant="ghost" size="sm" onClick={clear}><Eraser className="w-4 h-4 mr-1" /> Clear</Button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Handles quoted commas, escaped quotes and multi-line fields. Duplicate headers are renamed (name, name_2) so no data is lost.
        </p>
      </Card>
    </div>
  );
}
