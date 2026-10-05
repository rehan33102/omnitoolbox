"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import UserRow from "@/components/admin/UserRow";

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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load users");
      setUsers(json.users ?? []);
    } catch (err) {
      toast({ title: "Load failed", description: (err as Error).message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleSuspend = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, suspend: !u.banned }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      toast({
        title: u.banned ? "User unsuspended" : "User suspended",
        description: u.email,
        variant: "success",
      });
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, banned: !u.banned } : x)));
    } catch (err) {
      toast({ title: "Action failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: u.email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      toast({ title: "Reset email sent", description: `To ${u.email}`, variant: "success" });
    } catch (err) {
      toast({ title: "Reset failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(confirmDelete.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      toast({ title: "User deleted", description: confirmDelete.email, variant: "success" });
      setUsers((list) => list.filter((x) => x.id !== confirmDelete.id));
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-zinc-500 flex items-center gap-2">
          <Users size={15} /> {users.length} registered user{users.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 !py-2 text-sm w-64"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {/* Admin Actions Guide */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">What you can do with each user</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div><span className="font-medium text-zinc-900 dark:text-white">Click user row</span> — Expand to see what they created (images, voiceovers, QR codes, PDFs, videos) from the database</div>
            <div><span className="font-medium text-zinc-900 dark:text-white">Suspend / Unsuspend</span> — Temporarily block or restore user access without deleting</div>
            <div><span className="font-medium text-zinc-900 dark:text-white">Make Admin</span> — Grant full admin dashboard access (crown icon)</div>
            <div><span className="font-medium text-zinc-900 dark:text-white">Verify Email</span> — Manually confirm email without sending verification link</div>
            <div><span className="font-medium text-zinc-900 dark:text-white">Reset Password</span> — Send password reset email to the user</div>
            <div><span className="font-medium text-zinc-900 dark:text-white">Delete User</span> — Permanently remove account (cannot be undone)</div>
          </div>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            {users.length === 0 ? "No registered users yet." : "No users match your search."}
          </p>
        ) : (
          <div>
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                busy={busyId === u.id}
                onSuspend={toggleSuspend}
                onResetPassword={resetPassword}
                onDelete={(user) => setConfirmDelete(user)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete user?">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Permanently delete <b className="text-zinc-900 dark:text-zinc-100">{confirmDelete?.email}</b>?
          Their account and profile data will be removed. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={deleteUser} disabled={busyId === confirmDelete?.id}>
            {busyId === confirmDelete?.id ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
