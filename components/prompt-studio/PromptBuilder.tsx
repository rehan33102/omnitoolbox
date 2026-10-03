"use client";

import { useMemo, useState } from "react";
import { Check, Copy, History, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/components/ui/Toast";
import { saveRecord } from "@/lib/db";
import {
  MODEL_META, PRESET_STYLES, NEGATIVE_BANK, MJ_ASPECTS, type ModelId, type PresetStyle,
} from "@/data/prompt-presets";
import { cn } from "@/lib/utils";

const MODELS: ModelId[] = ["midjourney", "flux", "chatgpt", "claude"];

export default function PromptBuilder() {
  const [model, setModel] = useState<ModelId>("midjourney");
  const [subject, setSubject] = useState("");
  const [styles, setStyles] = useState<PresetStyle[]>([]);
  const [negatives, setNegatives] = useState<string[]>([]);
  const [customNeg, setCustomNeg] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [ar, setAr] = useState("16:9");
  const [stylize, setStylize] = useState(250);
  const [history, setHistory] = useLocalStorage<string[]>("otb-prompt-history", []);
  const { copy, copied } = useCopyToClipboard();
  const { toast } = useToast();

  const meta = MODEL_META[model];

  // Extract {variable} placeholders from the subject
  const variables = useMemo(
    () => [...new Set([...subject.matchAll(/\{([\w -]+)\}/g)].map((m) => m[1].trim()))],
    [subject]
  );

  const toggleStyle = (s: PresetStyle) =>
    setStyles((p) => (p.some((x) => x.id === s.id) ? p.filter((x) => x.id !== s.id) : [...p, s]));

  const toggleNegative = (n: string) =>
    setNegatives((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  const addCustomNegative = () => {
    const v = customNeg.trim().toLowerCase();
    if (v && !negatives.includes(v)) setNegatives((p) => [...p, v]);
    setCustomNeg("");
  };

  const finalPrompt = useMemo(() => {
    const filled = subject.replace(/\{([\w -]+)\}/g, (_, k: string) => values[k.trim()] || `{${k}}`);
    const styleText = styles.map((s) => s.snippet).join(", ");
    const base = [filled, styleText].filter(Boolean).join(", ");
    const neg = negatives.join(", ");

    switch (model) {
      case "midjourney":
        return `${base} --ar ${ar} --stylize ${stylize}${neg ? ` --no ${neg}` : ""} --v 6.0`.trim();
      case "flux":
        return `${base}${neg ? `\n\nAvoid: ${neg}` : ""}`.trim();
      case "chatgpt":
        return [
          "Act as an expert assistant.",
          "",
          "TASK:",
          filled || "[describe your task]",
          "",
          "STYLE:",
          styleText || "Clear, helpful, well-structured.",
          "",
          "CONSTRAINTS:",
          "- Be specific and actionable",
          "- Use headings and bullet points where helpful",
          "- Ask a clarifying question if the task is ambiguous",
        ].join("\n");
      case "claude":
        return [
          "<task>", filled || "[describe your task]", "</task>", "",
          "<context>", styleText || "General audience, professional tone.", "</context>", "",
          "<instructions>",
          "- Think step by step before answering",
          "- Flag assumptions explicitly",
          "- End with a concise summary of key takeaways",
          "</instructions>",
        ].join("\n");
    }
  }, [subject, styles, negatives, values, model, ar, stylize]);

  const saveToHistory = () => {
    if (!finalPrompt) return;
    setHistory((h) => [finalPrompt, ...h].slice(0, 20));
    // Also persist via the central records store (IndexedDB + localStorage
    // fallback) — best-effort, never blocks UX.
    try {
      void saveRecord("text", {
        tool: "prompt-builder",
        model,
        subject,
        prompt: finalPrompt,
        createdAt: Date.now(),
      });
    } catch {
      /* library save is non-critical */
    }
    toast({ title: "Saved to history", variant: "success" });
  };

  const words = finalPrompt ? finalPrompt.split(/\s+/).length : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Builder ─────────────────────────────── */}
      <Card className="space-y-5">
        <div className="flex items-center gap-2">
          <Wand2 size={18} className="text-brand-700 dark:text-brand-400" />
          <h2 className="font-display font-semibold">Build your prompt</h2>
        </div>

        <Tabs defaultValue={model}>
          <TabsList>
            {MODELS.map((m) => (
              <TabsTrigger key={m} value={m} onClick={() => setModel(m)}>
                {MODEL_META[m].label}
              </TabsTrigger>
            ))}
          </TabsList>
          {MODELS.map((m) => (
            <TabsContent key={m} value={m}>
              <p className="text-xs text-zinc-500">{MODEL_META[m].tagline}</p>
            </TabsContent>
          ))}
        </Tabs>

        <Textarea
          label="Subject / task"
          placeholder="A lone astronaut discovering a glowing forest…  •  Use {variables} like {product} or {audience}"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          hint="Tip: wrap reusable parts in {curly braces} to get fill-in fields below."
        />

        {variables.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Variables</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {variables.map((v) => (
                <input
                  key={v}
                  value={values[v] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [v]: e.target.value }))}
                  placeholder={`{${v}}`}
                  className="input-base"
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Preset styles <span className="text-zinc-500 font-normal">({styles.length} selected)</span></p>
          <div className="flex flex-wrap gap-2">
            {PRESET_STYLES[model].map((s) => {
              const on = styles.some((x) => x.id === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleStyle(s)}
                  className={cn(
                    "btn-base px-3 py-1.5 text-xs rounded-full border",
                    on ? "bg-brand-600/25 border-brand-500/50 text-zinc-900 dark:text-white" : "glass text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                >
                  {on && <Check size={12} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {meta.supportsNegative && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Negative prompt <span className="text-zinc-500 font-normal">(things to avoid)</span></p>
            <div className="flex flex-wrap gap-2">
              {NEGATIVE_BANK.map((n) => {
                const on = negatives.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => toggleNegative(n)}
                    className={cn(
                      "btn-base px-3 py-1.5 text-xs rounded-full border",
                      on ? "bg-red-600/25 border-red-500/50 text-red-700 dark:text-red-200" : "glass text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={customNeg}
                onChange={(e) => setCustomNeg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomNegative())}
                placeholder="Add custom negative…"
                className="input-base"
              />
              <Button variant="secondary" onClick={addCustomNegative}>Add</Button>
            </div>
          </div>
        )}

        {model === "midjourney" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Aspect ratio</p>
              <div className="flex flex-wrap gap-2">
                {MJ_ASPECTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAr(a)}
                    className={cn("btn-base px-3 py-1.5 text-xs rounded-lg border", ar === a ? "bg-brand-600/25 border-brand-500/50 text-zinc-900 dark:text-white" : "glass text-zinc-600 dark:text-zinc-400")}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Stylize: {stylize}</p>
              <input type="range" min={0} max={1000} step={50} value={stylize}
                onChange={(e) => setStylize(Number(e.target.value))} className="w-full accent-violet-500" />
            </div>
          </div>
        )}
      </Card>

      {/* ── Output ──────────────────────────────── */}
      <div className="space-y-4">
        <Card className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent-600 dark:text-accent-400" />
              <h2 className="font-display font-semibold">Generated prompt</h2>
            </div>
            <Badge variant="ai">{meta.label}</Badge>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200 bg-black/30 rounded-xl p-4 min-h-[220px] max-h-[420px] overflow-y-auto font-sans">
            {finalPrompt || <span className="text-zinc-500">Your optimized prompt will appear here…</span>}
          </pre>
          <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
            <span>{finalPrompt.length} chars · {words} words</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={saveToHistory} disabled={!finalPrompt}>
                <Save size={14} /> Save
              </Button>
              <Button size="sm" onClick={() => copy(finalPrompt, "Prompt copied!")} disabled={!finalPrompt}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy prompt"}
              </Button>
            </div>
          </div>
        </Card>

        {history.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-zinc-600 dark:text-zinc-400" />
                <h3 className="font-display font-semibold text-sm">History</h3>
              </div>
              <button onClick={() => setHistory([])} className="text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1">
                <Trash2 size={12} /> Clear
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => copy(h, "Prompt copied from history")}
                  className="w-full text-left text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white glass rounded-lg p-2.5 truncate transition"
                  title={h}
                >
                  {h.slice(0, 90)}…
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
