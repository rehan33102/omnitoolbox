import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata() {
  return buildMetadata({
    title: "Sign In — Omni Tool Box",
    description: "Sign in to your Omni Tool Box account to sync your library and settings across devices.",
    path: "/login",
    noIndex: true,
  });
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container py-16 grid place-items-center min-h-[70vh]">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 shadow-glow">
            <Sparkles size={19} className="text-white" />
          </span>
          <span className="font-display text-xl font-bold">
            Omni<span className="text-gradient">ToolBox</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
