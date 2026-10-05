import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Contact Us — Omni Tool Box",
  description: "Get in touch with the Omni Tool Box team. Send feedback, suggest new tools, or report issues — we read every message.",
  path: "/contact",
  keywords: ["contact", "feedback", "suggest tool", "support"],
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
