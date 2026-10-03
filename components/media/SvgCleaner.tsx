"use client";

import { useState } from "react";
import { Paintbrush, Check, Copy } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { formatBytes } from "@/lib/utils";

function cleanSvg(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+xmlns:(inkscape|sodipodi|dc|cc|rdf)="[^"]*"/gi, "")
    .replace(/<\/?(inkscape|sodipodi):[^>]*>/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

export default function SvgCleaner() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const { copy, copied } = useCopyToClipboard();

  const run = () => setOutput(cleanSvg(input));
  const saved = input && output ? Math.round((1 - output.length / input.length) * 100) : 0;

  return (
    <Card className="space-y-4">
      <Textarea
        label="Paste SVG markup"
        placeholder="<svg …>…</svg>"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="font-mono text-xs min-h-[160px]"
        hint="Strips comments, metadata, editor namespaces, scripts and excess whitespace."
      />
      <Button onClick={run} disabled={!input.trim()}>
        <Paintbrush size={16} /> Clean SVG
      </Button>

      {output && (
        <div className="space-y-3 animate-fade-up">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {formatBytes(input.length)} → {formatBytes(output.length)}
              <span className="text-emerald-700 dark:text-emerald-300 font-medium ml-2">{saved}% smaller</span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => copy(output, "Clean SVG copied")}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="text-xs font-mono text-zinc-300 bg-black/30 rounded-xl p-4 max-h-64 overflow-auto whitespace-pre-wrap break-all">
            {output}
          </pre>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-widest">Preview</p>
            <div className="bg-white rounded-lg p-4 grid place-items-center">
              <div className="w-24 h-24" dangerouslySetInnerHTML={{ __html: output }} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
