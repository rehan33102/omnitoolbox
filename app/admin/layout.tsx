import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // redirects non-admins — never renders for them

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-zinc-500">Manage tools, monetization and SEO — changes apply instantly, no redeploy.</p>
      </div>
      {/* Mobile nav — the sidebar is hidden on phones, so this is the only way to reach sub-pages on mobile */}
      <AdminMobileNav />
      <div className="flex gap-6 items-start">
        <AdminSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
