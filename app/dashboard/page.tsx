"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User, Mail, ShieldCheck, CalendarDays, LogOut, Library,
  Sparkles, Wrench, Image as ImageIcon, Mic, FileText, Video, QrCode,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { listBlobKinds, listByKind, getBlob, type BlobMeta } from "@/lib/db";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";

interface Profile {
  fullName: string;
  email: string;
  verified: boolean;
  memberSince: string;
  isAdmin: boolean;
}

const KIND_META: Record<string, { label: string; icon: typeof Mic }> = {
  voiceover: { label: "Voiceovers", icon: Mic },
  image: { label: "Images", icon: ImageIcon },
  qr: { label: "QR Codes", icon: QrCode },
  pdf: { label: "PDFs", icon: FileText },
  video: { label: "Videos", icon: Video },
};

/**
 * Personal user dashboard — /dashboard
 * Shows profile, library stats, usage breakdown, logout.
 * Sessions persist via Supabase Auth cookies (HttpOnly, auto-refresh);
 * closing/reopening the browser keeps the user signed in until Logout.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<BlobMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth?next=/dashboard");
        return;
      }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setProfile({
        fullName: String(meta.full_name ?? user.email?.split("@")[0] ?? "User"),
        email: user.email ?? "",
        verified: !!user.email_confirmed_at,
        memberSince: user.created_at
          ? new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "—",
        isAdmin: profileRow?.role === "admin",
      });

      // Library stats from on-device IndexedDB
      try {
        const kinds = await listBlobKinds();
        const c: Record<string, number> = {};
        const all: BlobMeta[] = [];
        for (const k of kinds) {
          const items = await listByKind(k, 100);
          c[k] = items.length;
          all.push(...items);
        }
        all.sort((a, b) => b.createdAt - a.createdAt);
        setCounts(c);
        setRecent(all.slice(0, 5));
      } catch {
        /* library unavailable — stats stay empty */
      }
      setLoading(false);
    })();
  }, [router]);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast({ title: "Logged out. See you soon! ", variant: "success" });
    window.location.href = "/";
  };

  // Open a recent item directly — download/view the actual file
  const openItem = async (item: BlobMeta) => {
    try {
      const data = await getBlob(item.id);
      if (!data?.blob) {
        toast({ title: "File not found", variant: "error" });
        return;
      }
      // For images and PDFs, open in new tab; for others, download
      const blob = data.blob as Blob;
      const url = URL.createObjectURL(blob);
      if (item.kind === "image" || item.kind === "pdf") {
        window.open(url, "_blank");
      } else {
        downloadBlob(blob, item.name);
      }
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast({ title: "Could not open file", variant: "error" });
    }
  };

  if (loading) {
    return (
      <div className="container py-10 max-w-4xl space-y-4">
        <Skeleton className="h-40" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!profile) return null;

  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);
  const initial = profile.fullName.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="container py-10 max-w-4xl space-y-6">
      {/* Profile header */}
      <Card className="border-2 border-brand-500/20">
        <div className="flex items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-white font-display text-2xl font-bold shadow-glow">
            {initial}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold truncate">{profile.fullName}</h1>
              {profile.isAdmin && <Badge variant="new">Admin</Badge>}
              <Badge variant={profile.verified ? "new" : "default"}>
                {profile.verified ? " Verified" : "Unverified"}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-1">
              <Mail size={14} /> {profile.email}
            </p>
            <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-0.5">
              <CalendarDays size={14} /> Member since {profile.memberSince}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="shrink-0">
            <LogOut size={15} /> Logout
          </Button>
        </div>
      </Card>

      {/* Stats — clickable, go to library */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/library">
          <Card className="!p-4 hover:border-brand-500/40 hover:shadow-md transition cursor-pointer">
            <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-wide">
              <Library size={14} /> Saved items
            </div>
            <p className="font-display text-3xl font-bold mt-1">{totalItems}</p>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">View all →</p>
          </Card>
        </Link>
        {Object.entries(KIND_META).map(([kind, { label, icon: Icon }]) => (
          <Link key={kind} href={`/library?kind=${kind}`}>
            <Card className="!p-4 hover:border-brand-500/40 hover:shadow-md transition cursor-pointer">
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-wide">
                <Icon size={14} /> {label}
              </div>
              <p className="font-display text-3xl font-bold mt-1">{counts[kind] ?? 0}</p>
              <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">View →</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">Recent creations</h2>
          <Link href="/library">
            <Button variant="ghost" size="sm">Open Library →</Button>
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <Sparkles size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nothing saved yet. Create something with the tools!</p>
            <Link href="/#tools">
              <Button size="sm" className="mt-3"><Wrench size={14} /> Browse tools</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {recent.map((item) => {
              const km = KIND_META[item.kind];
              const Icon = km?.icon ?? FileText;
              return (
                <button
                  key={item.id}
                  onClick={() => openItem(item)}
                  className="w-full block text-left"
                >
                  <div className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/5 transition cursor-pointer">
                    <span className="p-2 rounded-lg bg-black/5 dark:bg-white/10">
                      <Icon size={16} className="text-zinc-600 dark:text-zinc-400" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-zinc-500">
                        {km?.label ?? item.kind} · {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className="text-xs text-brand-600 dark:text-brand-400 font-medium shrink-0">
                      Open →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-4")}>
        <Link href="/library">
          <Card className="hover:border-brand-500/40 transition text-center !p-5">
            <Library size={22} className="mx-auto mb-2 text-brand-600" />
            <p className="font-semibold text-sm">My Library</p>
            <p className="text-xs text-zinc-500 mt-1">All saved creations</p>
          </Card>
        </Link>
        <Link href="/#tools">
          <Card className="hover:border-brand-500/40 transition text-center !p-5">
            <Wrench size={22} className="mx-auto mb-2 text-brand-600" />
            <p className="font-semibold text-sm">Explore Tools</p>
            <p className="text-xs text-zinc-500 mt-1">Create something new</p>
          </Card>
        </Link>
        <Link href="/tutorial">
          <Card className="hover:border-brand-500/40 transition text-center !p-5">
            <ShieldCheck size={22} className="mx-auto mb-2 text-brand-600" />
            <p className="font-semibold text-sm">Tutorials</p>
            <p className="text-xs text-zinc-500 mt-1">Learn every tool</p>
          </Card>
        </Link>
      </div>

      {/* Session note */}
      <p className="text-xs text-zinc-500 text-center flex items-center justify-center gap-1.5">
        <User size={13} /> You stay logged in on this device until you press Logout — even if you close the browser.
      </p>
    </div>
  );
}
