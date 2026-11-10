import { buildMetadata } from "@/lib/seo";

export async function generateMetadata() {
  return buildMetadata({
    title: "Sign In — Omni Tool Box",
    description: "Sign in to your Omni Tool Box account to sync your library and settings across devices.",
    path: "/login",
    noIndex: true,
  });
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
