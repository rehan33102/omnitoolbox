import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ShieldAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import AdminSearch from "@/components/admin/AdminSearch";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // SECRET BYPASS: owner's private link sets boss_key cookie — skip all auth.
  // Middleware redirects ?boss=... to clean URL after setting cookie, so cookie is always present here.
  const cookieStore = await cookies();
  const bypassKey = process.env.ADMIN_BYPASS_KEY;
  const isBoss = !!bypassKey && cookieStore.get("boss_key")?.value === bypassKey;
  if (isBoss) {
    return (
      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          <AdminSearch />
        </div>
        <AdminMobileNav />
        <div className="flex gap-6 items-start">
          <AdminSidebar />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    );
  }

  const user = await getSessionUser();

  // Not logged in → redirect to dedicated admin auth page.
  if (!user) {
    redirect("/admin/auth");
  }

  // Logged in but not admin → clear message instead of a confusing redirect.
  if (user.role !== "admin") {
    return (
      <div className="container py-16 max-w-md mx-auto">
        <Card className="text-center">
          <span className="inline-flex p-3 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 mb-4">
            <ShieldAlert size={22} />
          </span>
          <h1 className="font-display text-xl font-bold mb-2">Access denied</h1>
          <p className="text-sm text-zinc-500">
            {user.email} is signed in but doesn&apos;t have admin access.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
        <AdminSearch />
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
