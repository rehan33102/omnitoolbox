"use client";

import { useState } from "react";
import { Ban, ChevronDown, Crown, FileText, Image, KeyRound, MailCheck, Mic, QrCode, Clapperboard, Trash2, UserCheck, ShieldCheck } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  banned: boolean;
  isSelf: boolean;
}

interface Creation {
  id: number;
  kind: string;
  name: string;
  tool_slug: string | null;
  created_at: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

const KIND_ICONS: Record<string, any> = {
  voiceover: Mic,
  image: Image,
  qr: QrCode,
  pdf: FileText,
  video: Clapperboard,
};

const KIND_LABELS: Record<string, string> = {
  voiceover: "Voiceovers",
  image: "Images",
  qr: "QR Codes",
  pdf: "PDFs",
  video: "Videos",
};

export default function UserRow({
  user,
  onSuspend,
  onResetPassword,
  onDelete,
  onRefresh,
  busy,
}: {
  user: AdminUser;
  onSuspend: (u: AdminUser) => void;
  onResetPassword: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [creations, setCreations] = useState<Creation[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCreations, setLoadingCreations] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const toggleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && creations === null) {
      setLoadingCreations(true);
      try {
        const res = await fetch(`/api/admin/user-creations?userId=${user.id}&email=${encodeURIComponent(user.email)}&limit=100`);
        const json = await res.json();
        if (res.ok) {
          setCreations(json.creations ?? []);
          setCounts(json.counts ?? {});
        }
      } catch {}
      setLoadingCreations(false);
    }
  };

  const totalCreations = Object.values(counts).reduce((a, b) => a + b, 0);

  // Make or remove admin
  const toggleAdmin = async () => {
    setActionBusy("admin");
    try {
      const res = await fetch("/api/admin/users/make-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, makeAdmin: !isAdmin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setIsAdmin(!isAdmin);
      toast({ title: isAdmin ? "Admin removed" : "Made admin", description: user.email, variant: "success" });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionBusy(null);
    }
  };

  // Manually verify email
  const verifyEmail = async () => {
    setActionBusy("verify");
    try {
      const res = await fetch("/api/admin/users/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast({ title: "Email verified", description: user.email, variant: "success" });
      onRefresh();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="border-b border-black/5 dark:border-white/5 last:border-0">
      {/* Clickable user header */}
      <div
        onClick={toggleExpand}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(); } }}
        role="button"
        tabIndex={0}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition cursor-pointer select-none"
      >
        <span className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300 shrink-0">
          <ShieldCheck size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{user.email}</p>
            {user.isSelf && <Badge variant="pro">you</Badge>}
            {user.banned ? (
              <Badge variant="pdf">suspended</Badge>
            ) : user.emailConfirmed ? (
              <Badge variant="ai">active</Badge>
            ) : (
              <Badge variant="text">unverified</Badge>
            )}
            {totalCreations > 0 && (
              <Badge variant="default">{totalCreations} creations</Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {user.fullName || "No name set"} · Joined {fmtDate(user.createdAt)} · Last login {fmtDate(user.lastSignInAt)}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={cn("text-zinc-400 transition-transform shrink-0", expanded && "rotate-180")}
        />
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Account Status: Suspend or unsuspend user access */}
          <button
            onClick={() => onSuspend(user)}
            disabled={busy || user.isSelf}
            title={user.banned ? "Unsuspend user — restore their access" : "Suspend user — block their access temporarily"}
            className="p-2 rounded-lg hover:bg-amber-500/10 transition disabled:opacity-40"
          >
            {user.banned ? (
              <UserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Ban size={16} className="text-amber-600 dark:text-amber-400" />
            )}
          </button>
          {/* Admin Role: Grant or revoke admin dashboard access */}
          <button
            onClick={toggleAdmin}
            disabled={busy || user.isSelf || actionBusy === "admin"}
            title={isAdmin ? "Remove admin — revoke dashboard access" : "Make admin — grant full dashboard access"}
            className="p-2 rounded-lg hover:bg-purple-500/10 transition disabled:opacity-40"
          >
            <Crown size={16} className={isAdmin ? "text-purple-600 dark:text-purple-400" : "text-zinc-400"} />
          </button>
          {/* Email Verification: Manually confirm user's email */}
          {!user.emailConfirmed && (
            <button
              onClick={verifyEmail}
              disabled={busy || actionBusy === "verify"}
              title="Verify email — manually confirm without email link"
              className="p-2 rounded-lg hover:bg-emerald-500/10 transition disabled:opacity-40"
            >
              <MailCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
            </button>
          )}
          {/* Password: Send reset link to user's email */}
          <button
            onClick={() => onResetPassword(user)}
            disabled={busy}
            title="Reset password — send password reset email to user"
            className="p-2 rounded-lg hover:bg-blue-500/10 transition disabled:opacity-40"
          >
            <KeyRound size={16} className="text-blue-600 dark:text-blue-400" />
          </button>
          {/* Delete: Permanently remove user account */}
          <button
            onClick={() => onDelete(user)}
            disabled={busy || user.isSelf}
            title="Delete user — permanently remove account (cannot undo)"
            className="p-2 rounded-lg hover:bg-red-500/10 transition disabled:opacity-40"
          >
            <Trash2 size={16} className="text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>

      {/* Expandable creations */}
      {expanded && (
        <div className="px-4 pb-4 pl-[72px]">
          {loadingCreations ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !creations || creations.length === 0 ? (
            <p className="text-sm text-zinc-500 py-3">
              No creations yet. When this user generates voiceovers, images, QR codes, PDFs or videos, they&apos;ll appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Counts */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(counts).map(([kind, n]) => {
                  const Icon = KIND_ICONS[kind] ?? FileText;
                  return (
                    <span
                      key={kind}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-xs font-medium"
                    >
                      <Icon size={13} />
                      {KIND_LABELS[kind] ?? kind}: {n}
                    </span>
                  );
                })}
              </div>
              {/* Recent creations list */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {creations.slice(0, 30).map((c) => {
                  const Icon = KIND_ICONS[c.kind] ?? FileText;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]"
                    >
                      <span className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10">
                        <Icon size={14} className="text-zinc-600 dark:text-zinc-400" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-zinc-500">
                          {KIND_LABELS[c.kind] ?? c.kind}
                          {c.tool_slug && ` · ${c.tool_slug}`} ·{" "}
                          {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
