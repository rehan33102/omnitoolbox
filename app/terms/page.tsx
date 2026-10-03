import { buildMetadata } from "@/lib/seo";
import Card from "@/components/ui/Card";

export const metadata = buildMetadata({
  title: "Terms of Service",
  description: "The rules for using OmniToolBox's free tools.",
  path: "/terms",
});

const SECTIONS = [
  {
    h: "Free to use",
    p: "All tools on OmniToolBox are free for personal and commercial use. No signup is required for core features, and we do not place watermarks on your outputs.",
  },
  {
    h: "Fair use",
    p: "Don't abuse the service: no automated scraping at unreasonable rates, no attempts to disrupt the site, and no using the tools for anything illegal. We may rate-limit or block abusive traffic.",
  },
  {
    h: "Your content",
    p: "You own everything you create with our tools. Because processing happens in your browser, we never even see your files. You are responsible for having the rights to any content you process.",
  },
  {
    h: "AI-generated content",
    p: "Outputs from AI-assisted tools (prompt studio, voiceover voices) are provided as-is. Always review generated content before publishing or relying on it.",
  },
  {
    h: "No warranties",
    p: "The site is provided \"as is\" without warranties of any kind. We work hard to keep tools accurate and available, but we can't guarantee uninterrupted service or error-free results.",
  },
  {
    h: "Limitation of liability",
    p: "To the maximum extent permitted by law, OmniToolBox is not liable for any indirect or consequential damages arising from use of the site.",
  },
  {
    h: "Changes",
    p: "We may update these terms as the site evolves. Continued use after changes means you accept the new terms.",
  },
];

export default function TermsPage() {
  return (
    <div className="container py-10 max-w-3xl">
      <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Terms of Service</h1>
      <p className="text-sm text-zinc-500 mb-8">Effective: October 2026</p>
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <Card key={s.h}>
            <h2 className="font-display font-semibold text-lg mb-2">{s.h}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{s.p}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
