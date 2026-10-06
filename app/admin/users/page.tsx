"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, MailPlus, RefreshCw, Search, Trash2, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import UserRow from "@/components/admin/UserRow";

type Role = "admin" | "moderator" | "user" | "banned";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  banned: boolean;
  role: Role;
  isSelf: boolean;
}

interface Diagnostics {
  listUsersOk: boolean;
  error?: string;
  serviceKeyPresent: boolean;
  fetchedAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  token: string;
  link: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  expired: boolean;
}

type SortMode = "newest" | "oldest" | "name";

const ROLE_OPTIONS: Role[] = ["admin", "moderator", "user", "banned"];

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
  const [sort, setSort] = useState<SortMode>("newest");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [canManageUsers, setCanManageUsers] = useState(true);
  const { toast } = useToast();

  // Invites
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("moderator");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load users");
      setUsers(json.users ?? []);
      setDiagnostics(json.diagnostics ?? null);
      // Non-blocking status: surface API-side failures visibly, never silently.
      if (json.diagnostics && !json.diagnostics.listUsersOk) {
        toast({
          title: "Users API returned an error",
          description: json.diagnostics.error ?? "Could not list users — see the status line below.",
          variant: "error",
        });
      }
    } catch (err) {
      toast({ title: "Load failed", description: (err as Error).message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadMe = async () => {
    try {
      const res = await fetch("/api/admin/me");
      const json = await res.json();
      if (res.ok) setCanManageUsers((json.permissions ?? []).includes("users"));
    } catch {}
  };

  const loadInvites = async () => {
    setInvitesLoading(true);
    try {
      const res = await fetch("/api/admin/invites");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load invites");
      setInvites(json.invites ?? []);
    } catch (err) {
      toast({ title: "Invites failed to load", description: (err as Error).message, variant: "error" });
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadMe();
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? users.filter((u) => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
      : [...users];
    list.sort((a, b) => {
      if (sort === "name") return (a.fullName || a.email).localeCompare(b.fullName || b.email);
      const da = +new Date(a.createdAt);
      const db = +new Date(b.createdAt);
      return sort === "newest" ? db - da : da - db;
    });
    return list;
  }, [users, search, sort]);

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
      toast({
        title: "User deleted",
        description: json.verified ? `${confirmDelete.email} — deletion verified` : confirmDelete.email,
        variant: "success",
      });
      setUsers((list) => list.filter((x) => x.id !== confirmDelete.id));
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  const createInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast({ title: "Email required", description: "Enter the invitee's email address.", variant: "error" });
      return;
    }
    setCreatingInvite(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create invite");
      toast({ title: "Invite created", description: `${email} invited as ${inviteRole}`, variant: "success" });
      setInviteEmail("");
      loadInvites();
    } catch (err) {
      toast({ title: "Invite failed", description: (err as Error).message, variant: "error" });
    } finally {
      setCreatingInvite(false);
    }
  };

  const revokeInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/invites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to revoke");
      toast({ title: "Invite revoked", variant: "success" });
      setInvites((list) => list.filter((i) => i.id !== id));
    } catch (err) {
      toast({ title: "Revoke failed", description: (err as Error).message, variant: "error" });
    }
  };

  const copyLink = async (invite: Invite) => {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopiedId(invite.id);
      toast({ title: "Invite link copied", description: invite.email, variant: "success" });
      setTimeout(() => setCopiedId((c) => (c === invite.id ? null : c)), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Long-press the link text to copy it manually.", variant: "error" });
    }
  };

  const pendingInvites = invites.filter((i) => !i.usedAt && !i.expired);
  const pastInvites = invites.filter((i) => i.usedAt || i.expired);

  return (
    <div className="space-y-4">
      {/* Diagnostics status line — visible, non-blocking */}
      {diagnostics && (
        <div
          className={
            diagnostics.listUsersOk
              ? "flex items-center gap-2 text-xs rounded-xl px-3 py-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
              : "flex items-start gap-2 text-xs rounded-xl px-3 py-2 bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30"
          }
        >
          {diagnostics.listUsersOk ? (
            <CheckCircle2 size={14} className="shrink-0 mt-px" />
          ) : (
            <AlertTriangle size={14} className="shrink-0 mt-px" />
          )}
          <span>
            {diagnostics.listUsersOk ? (
              <>Users API OK · {users.length} user{users.length === 1 ? "" : "s"} loaded · service key present</>
            ) : (
              <>
                <b>Users API error:</b> {diagnostics.error ?? "unknown"} ·{" "}
                {diagnostics.serviceKeyPresent ? "service key is set" : "SUPABASE_SERVICE_ROLE_KEY is missing"} ·{" "}
                no data shown rather than guessed data
              </>
            )}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-zinc-500 flex items-center gap-2">
          <Users size={15} /> {users.length} registered user{users.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="input-base !py-2 text-sm pr-8"
            title="Sort users"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 !py-2 text-sm w-64"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => { load(); loadInvites(); }} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {/* Admin Actions Guide */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">What you can do with each user</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div><span className="font-medium text-zinc-900 dark:text-white">Click user row</span> — Expand for full details, role changer, name/email editing, and what they created</div>
            <div><span className="font-medium text-zinc-900 dark:text-white">Role changer</span> — Set Admin (full control), Moderator (partial access), User, or Banned</div>
            <div><span className="font-medium text-zinc-900 dark:text-white">Suspend / Unsuspend</span> — Temporarily block or restore user access without deleting</div>
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

      {/* Invites — Meta-style people management */}
      {canManageUsers && (
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <MailPlus size={16} className="text-brand-600 dark:text-brand-400" />
            <h2 className="font-display text-lg font-bold">Team invites</h2>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Invite someone by email with a role. They sign up through the invite link and the role is applied
            automatically. Invites expire after 7 days and can be revoked anytime.
          </p>
          <div className="flex flex-wrap items-end gap-2 mb-5">
            <Input
              label="Email"
              type="email"
              placeholder="teammate@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="!py-2 text-sm w-64"
            />
            <div>
              <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="input-base !py-2 text-sm pr-8"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={createInvite} disabled={creatingInvite}>
              <MailPlus size={14} /> {creatingInvite ? "Creating…" : "Send invite"}
            </Button>
          </div>

          {invitesLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : invites.length === 0 ? (
            <p className="text-sm text-zinc-500">No invites yet. Create one above to bring a teammate on board.</p>
          ) : (
            <div className="space-y-4">
              {pendingInvites.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Pending ({pendingInvites.length})
                  </p>
                  <div className="space-y-2">
                    {pendingInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 flex-wrap rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{inv.email}</p>
                          <p className="text-xs text-zinc-500">
                            Invited as <b>{inv.role}</b> · expires {fmtDate(inv.expiresAt)}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate select-all">{inv.link}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="sm" variant="secondary" onClick={() => copyLink(inv)}>
                            <Copy size={13} /> {copiedId === inv.id ? "Copied" : "Copy link"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => revokeInvite(inv.id)} title="Revoke invite">
                            <Trash2 size={13} /> Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pastInvites.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Used / expired ({pastInvites.length})
                  </p>
                  <div className="space-y-1.5">
                    {pastInvites.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-3 text-xs text-zinc-500 px-1 py-1">
                        <span className="truncate flex-1">{inv.email} · {inv.role}</span>
                        <span className="shrink-0">{inv.usedAt ? `used ${fmtDate(inv.usedAt)}` : "expired"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

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
