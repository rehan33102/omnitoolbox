import { buildMetadata } from "@/lib/seo";
import Card from "@/components/ui/Card";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description: "How OmniToolBox handles your data: tools run in your browser, files never leave your device.",
  path: "/privacy",
});

const SECTIONS = [
  {
    h: "The short version",
    p: "Almost everything on OmniToolBox runs entirely in your browser. Your files, text and images never leave your device unless a feature explicitly says otherwise.",
  },
  {
    h: "What we collect",
    p: "We collect the minimum needed to run the site: (1) anonymous usage counts (which tool was opened, how many times it was used) stored in our database — no names, no emails, no file contents; (2) if you create an account, your email address and basic profile info, used only for sign-in and saved preferences.",
  },
  {
    h: "What we never collect",
    p: "We never upload, store or see the files you process. Image tools, PDF tools and the voiceover studio run 100% client-side via your browser — your documents stay on your device. We never sell personal data to anyone.",
  },
  {
    h: "Cookies",
    p: "We use essential cookies only: a session cookie to keep you signed in (if you use an account) and a theme preference cookie. No advertising cookies are set by us directly.",
  },
  {
    h: "Third-party services",
    p: "Pages may load fonts (Google Fonts) and, in the future, advertising scripts (e.g. Google AdSense) which have their own privacy policies. The background remover downloads its AI model from a public CDN on first use.",
  },
  {
    h: "Your rights",
    p: "You can request deletion of your account and associated data at any time via the contact page. Anonymous usage statistics cannot be tied back to you.",
  },
  {
    h: "Changes",
    p: "If this policy changes materially, we will update this page and the effective date below.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="container py-10 max-w-3xl">
      <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Privacy Policy</h1>
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
