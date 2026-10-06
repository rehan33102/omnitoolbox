import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import PromptBuilder from "@/components/prompt-studio/PromptBuilder";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

export async function generateMetadata() {
  return buildMetadata({
    title: "AI Prompt Studio — Free AI Prompt Generator",
    description: "Generate and optimize AI prompts with preset styles, negative-prompt builder and {variable} placeholders. One-click copy. Free, no signup.",
    path: "/ai-prompt-studio",
    keywords: ["prompt generator", "midjourney prompt builder", "chatgpt prompt optimizer", "flux prompts", "claude prompts", "negative prompt"],
  });
}

const STEPS = [
  { n: "1", t: "Pick your model", d: "Midjourney, Flux, ChatGPT or Claude — syntax adapts automatically." },
  { n: "2", t: "Describe + style it", d: "Add your subject, stack preset styles, ban what you hate with negatives." },
  { n: "3", t: "Copy & create", d: "One click copies the optimized prompt. Save winners to history." },
];

export default function PromptStudioPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "AI Prompt Studio", description: "Free multi-model AI prompt generator and optimizer.", url: serverSiteUrl("/ai-prompt-studio"), category: "ai" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AI Prompt Studio", path: "/ai-prompt-studio" }]),
      ]} />
      <TrackUsage slug="ai-prompt-studio" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="ai">AI Tool</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          AI Prompt <span className="text-gradient">Studio</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          Build better prompts for Midjourney, ChatGPT, Flux and Claude — preset styles,
          negative-prompt builder, reusable {"{variables}"} and one-click copy.
        </p>
      </div>

      <PromptBuilder />


      <div className="grid sm:grid-cols-3 gap-4 mt-10">
        <h2 className="sm:col-span-3 font-display text-xl md:text-2xl font-bold tracking-tight">
          How it works
        </h2>
        {STEPS.map((s) => (
          <Card key={s.n}>
            <p className="font-display text-3xl font-extrabold text-gradient mb-2">{s.n}</p>
            <h3 className="font-display font-semibold mb-1">{s.t}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.d}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
