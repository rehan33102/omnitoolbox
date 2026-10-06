import { buildMetadata } from "@/lib/seo";

export async function generateMetadata() {
  return buildMetadata({
    title: "Hire Me — Custom Tools & Web Development",
    description: "Need a custom web tool, website or app? I build fast, modern tools like the ones on this site. Get in touch on WhatsApp.",
    path: "/hire-me",
    keywords: ["hire developer", "custom tool development", "web development", "freelance"],
  });
}

export default function HireMeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
