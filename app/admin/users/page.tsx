"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, KeyRound, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

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
        {loading ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            {users.length === 0 ? "No registered users yet." : "No users match your search."}
          </p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {filtered.map((u) => (
              <div key={u.id} className="p-4 flex items-center gap-4">
                <span className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300 shrink-0">
                  <ShieldCheck size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{u.email}</p>
                    {u.isSelf && <Badge variant="pro">you</Badge>}
                    {u.banned ? (
                      <Badge variant="pdf">suspended</Badge>
                    ) : u.emailConfirmed ? (
                      <Badge variant="ai">active</Badge>
                    ) : (
                      <Badge variant="text">unverified</Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {u.fullName || "No name set"} · Joined {fmtDate(u.createdAt)} · Last login {fmtDate(u.lastSignInAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleSuspend(u)}
                    disabled={busyId === u.id || u.isSelf}
                    title={u.banned ? "Unsuspend user" : "Suspend user"}
                    className="p-2 rounded-lg hover:bg-amber-500/10 transition disabled:opacity-40"
                  >
                    {u.banned ? (
                      <UserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Ban size={16} className="text-amber-600 dark:text-amber-400" />
                    )}
                  </button>
                  <button
                    onClick={() => resetPassword(u)}
                    disabled={busyId === u.id}
                    title="Send password reset email"
                    className="p-2 rounded-lg hover:bg-blue-500/10 transition disabled:opacity-40"
                  >
                    <KeyRound size={16} className="text-blue-600 dark:text-blue-400" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(u)}
                    disabled={busyId === u.id || u.isSelf}
                    title="Delete user"
                    className="p-2 rounded-lg hover:bg-red-500/10 transition disabled:opacity-40"
                  >
                    <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
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
