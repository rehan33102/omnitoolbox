import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "My Dashboard — Omni Tool Box",
  description: "Your personal Omni Tool Box dashboard.",
  path: "/dashboard",
  noIndex: true,
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
