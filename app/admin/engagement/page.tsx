"use client";

import { useEffect, useState } from "react";
import { Bell, KeyRound, Megaphone, Pencil, Plus, Save, Send, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Input, Textarea } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Announcement {
  id: string;
  text: string;
  linkUrl: string;
  enabled: boolean;
  createdAt?: string;
}

interface PushStatus {
  configured: boolean;
  publicKey: string | null;
  subscriberCount: number;
}

function SectionHead({ icon: Icon, title, desc }: { icon: typeof Megaphone; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
        <Icon size={18} />
      </span>
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-sm text-zinc-500">{desc}</p>
      </div>
    </div>
  );
}

export default function EngagementPage() {
  const { toast } = useToast();

  // --- announcements list state ---
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(true);

  // --- composer state (new announcement) ---
  const [newText, setNewText] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newEnabled, setNewEnabled] = useState(true);
  const [adding, setAdding] = useState(false);

  // --- per-row state ---
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editLink, setEditLink] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- push state ---
  const [push, setPush] = useState<PushStatus | null>(null);
  const [pushLoading, setPushLoading] = useState(true);
  const [keysWorking, setKeysWorking] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushUrl, setPushUrl] = useState("/");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/announcement", { cache: "no-store" });
        const data = await r.json();
        if (Array.isArray(data?.announcements)) setAnnouncements(data.announcements);
      } catch {
        toast({ title: "Failed to load announcements", variant: "error" });
      } finally {
        setAnnLoading(false);
      }
    })();
  }, [toast]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/push", { cache: "no-store" });
        const data = await r.json();
        setPush({ configured: !!data.configured, publicKey: data.publicKey ?? null, subscriberCount: data.subscriberCount ?? 0 });
      } catch {
        /* push section stays in loading-failed state below */
      } finally {
        setPushLoading(false);
      }
    })();
  }, []);

  const addAnnouncement = async () => {
    if (!newText.trim()) {
      toast({ title: "Announcement text is required", variant: "error" });
      return;
    }
    setAdding(true);
    try {
      const r = await fetch("/api/admin/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText.trim(), linkUrl: newLink.trim(), enabled: newEnabled }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Save failed");
      // Server returns the fresh full list — use it as the single source of truth.
      if (Array.isArray(data?.announcements)) setAnnouncements(data.announcements);
      setNewText("");
      setNewLink("");
      setNewEnabled(true);
      toast({ title: "Announcement added", description: newEnabled ? "Live on the site now" : "Saved (currently disabled)", variant: "success" });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setAdding(false);
    }
  };

  const toggleAnnouncement = async (id: string, enabled: boolean) => {
    setTogglingId(id);
    try {
      const r = await fetch(`/api/admin/announcement/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Toggle failed");
      if (Array.isArray(data?.announcements)) setAnnouncements(data.announcements);
      toast({ title: enabled ? "Announcement enabled" : "Announcement disabled", variant: "success" });
    } catch (e) {
      toast({ title: "Toggle failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setEditText(a.text);
    setEditLink(a.linkUrl);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editText.trim()) {
      toast({ title: "Announcement text is required", variant: "error" });
      return;
    }
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/admin/announcement/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText.trim(), linkUrl: editLink.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Save failed");
      if (Array.isArray(data?.announcements)) setAnnouncements(data.announcements);
      setEditingId(null);
      toast({ title: "Announcement updated", variant: "success" });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteAnnouncement = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/announcement/${deleteTarget.id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Delete failed");
      if (Array.isArray(data?.announcements)) setAnnouncements(data.announcements);
      toast({ title: "Announcement deleted", variant: "success" });
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const generateKeys = async () => {
    setKeysWorking(true);
    try {
      const r = await fetch("/api/admin/push", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Key generation failed");
      setPush((p) => (p ? { ...p, configured: true, publicKey: data.publicKey } : { configured: true, publicKey: data.publicKey, subscriberCount: 0 }));
      toast({ title: "VAPID keys generated", description: "Push notifications are now configured", variant: "success" });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setKeysWorking(false);
    }
  };

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      toast({ title: "Title and body are required", variant: "error" });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const r = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pushTitle.trim(), body: pushBody.trim(), url: pushUrl.trim() || "/" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Send failed");
      setSendResult(`Delivered to ${data.sent} of ${data.total} subscribers${data.pruned ? ` — ${data.pruned} dead endpoint(s) pruned` : ""}.`);
      toast({ title: "Push sent", description: `${data.sent}/${data.total} delivered`, variant: "success" });
      setPushTitle("");
      setPushBody("");
    } catch (e) {
      toast({ title: "Send failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Engagement</h1>
        <p className="text-sm text-zinc-500 mt-1">Site-wide announcement bars and web push notifications.</p>
      </div>

      {/* ---------------- Announcements ---------------- */}
      <Card>
        <SectionHead
          icon={Megaphone}
          title="Announcement bars"
          desc="Slim banners shown at the very top of every page. Add as many as you like — each has its own on/off switch. Users can dismiss each one individually."
        />
        {annLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Composer — creates a NEW announcement, never replaces */}
            <div className="space-y-4 rounded-xl border border-black/10 dark:border-white/10 p-4">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Plus size={15} /> Add announcement
              </p>
              <Textarea
                label={`Announcement text (${newText.length}/200)`}
                value={newText}
                maxLength={200}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="e.g. New: AI Background Studio just launched — try it free"
              />
              <Input
                label="Link URL (optional)"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="/tools/background-studio or https://…"
                hint="The whole bar becomes clickable. Leave empty for a non-clickable banner."
              />
              <div className="flex items-center gap-3">
                <Switch checked={newEnabled} onChange={setNewEnabled} label="Show immediately" />
                <span className="text-sm font-medium">{newEnabled ? "Enabled" : "Disabled"}</span>
              </div>
              <Button onClick={addAnnouncement} disabled={adding}>
                <Save size={16} className="mr-2" />
                {adding ? "Adding…" : "Add announcement"}
              </Button>
            </div>

            {/* List */}
            {announcements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-8 text-center">
                <Megaphone size={20} className="mx-auto mb-2 text-zinc-400" />
                <p className="text-sm font-medium">No announcements yet</p>
                <p className="text-xs text-zinc-500 mt-1">Add your first announcement above — it will appear at the top of every page.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold">
                  All announcements <span className="text-zinc-500 font-normal">({announcements.length})</span>
                </p>
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3"
                  >
                    {editingId === a.id ? (
                      <div className="space-y-3">
                        <Textarea
                          label={`Announcement text (${editText.length}/200)`}
                          value={editText}
                          maxLength={200}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        <Input
                          label="Link URL (optional)"
                          value={editLink}
                          onChange={(e) => setEditLink(e.target.value)}
                          placeholder="/tools/background-studio or https://…"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                            {savingEdit ? "Saving…" : "Save changes"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={savingEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium break-words">{a.text}</p>
                            <p className="text-xs text-zinc-500 mt-1 truncate">
                              {a.linkUrl ? `Links to ${a.linkUrl}` : "No link — banner only"}
                              {a.createdAt ? ` · Added ${new Date(a.createdAt).toLocaleDateString()}` : ""}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              a.enabled
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {a.enabled ? "Live" : "Off"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Switch
                            checked={a.enabled}
                            onChange={(v) => toggleAnnouncement(a.id, v)}
                            label={`Toggle ${a.text.slice(0, 30)}`}
                            disabled={togglingId === a.id}
                          />
                          <span className="text-xs text-zinc-500 mr-1">
                            {togglingId === a.id ? "Saving…" : a.enabled ? "On" : "Off"}
                          </span>
                          <span className="flex-1" />
                          <Button size="sm" variant="outline" onClick={() => startEdit(a)} aria-label="Edit announcement">
                            <Pencil size={14} className="mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteTarget(a)}
                            aria-label="Delete announcement"
                          >
                            <Trash2 size={14} className="mr-1" /> Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete announcement?"
        message={deleteTarget ? `Delete "${deleteTarget.text.slice(0, 80)}"? It will stop showing on the site immediately. Other announcements are not affected.` : ""}
        onConfirm={deleteAnnouncement}
        onClose={() => !deleting && setDeleteTarget(null)}
        busy={deleting}
      />

      {/* ---------------- Web push ---------------- */}
      <Card>
        <SectionHead
          icon={Bell}
          title="Web push notifications"
          desc="Real push via VAPID + service worker. Browsers ask visitors to opt in; you broadcast from here."
        />
        {pushLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : push && !push.configured ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              Push is not configured yet. Generate a VAPID key pair — the public key goes to browsers, the private key
              stays server-side in the KV store.
            </p>
            <Button onClick={generateKeys} disabled={keysWorking}>
              <KeyRound size={16} className="mr-2" />
              {keysWorking ? "Generating…" : "Generate VAPID keys"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-3 text-sm">
              <p>
                Status: <span className="font-semibold text-emerald-600 dark:text-emerald-400">Configured</span>
                {" · "}
                {push?.subscriberCount ?? 0} subscriber{(push?.subscriberCount ?? 0) === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-zinc-500 mt-1 truncate">
                Public key: <code>{push?.publicKey?.slice(0, 40)}…</code>
              </p>
              <button
                type="button"
                onClick={generateKeys}
                disabled={keysWorking}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline mt-1"
              >
                {keysWorking ? "Regenerating…" : "Regenerate keys (invalidates old subscriptions)"}
              </button>
            </div>

            <div className="space-y-4">
              <Input
                label={`Notification title (${pushTitle.length}/80)`}
                value={pushTitle}
                maxLength={80}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="e.g. New tool just dropped"
              />
              <Textarea
                label={`Message (${pushBody.length}/200)`}
                value={pushBody}
                maxLength={200}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="e.g. AI Background Studio is live — remove and restyle photo backgrounds free"
              />
              <Input
                label="Opens this page when tapped"
                value={pushUrl}
                onChange={(e) => setPushUrl(e.target.value)}
                placeholder="/tools/background-studio"
              />
              {sendResult && <p className="text-sm text-emerald-600 dark:text-emerald-400">{sendResult}</p>}
              <Button onClick={sendPush} disabled={sending || (push?.subscriberCount ?? 0) === 0}>
                <Send size={16} className="mr-2" />
                {sending ? "Sending…" : `Send to ${push?.subscriberCount ?? 0} subscriber${(push?.subscriberCount ?? 0) === 1 ? "" : "s"}`}
              </Button>
              {(push?.subscriberCount ?? 0) === 0 && (
                <p className="text-xs text-zinc-500">No subscribers yet — the opt-in prompt appears for visitors once push is configured.</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
