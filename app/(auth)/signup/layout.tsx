import { buildMetadata } from "@/lib/seo";

export async function generateMetadata() {
  return buildMetadata({
    title: "Sign Up — Omni Tool Box",
    description: "Create your free Omni Tool Box account to sync your library and settings across devices.",
    path: "/signup",
    noIndex: true,
  });
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
