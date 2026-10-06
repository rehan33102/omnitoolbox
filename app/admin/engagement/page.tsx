"use client";

import { useEffect, useState } from "react";
import { Bell, KeyRound, Megaphone, Save, Send } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import { Input, Textarea } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Announcement {
  id: string;
  text: string;
  linkUrl: string;
  enabled: boolean;
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

  // --- announcement state ---
  const [ann, setAnn] = useState<Announcement>({ id: "default", text: "", linkUrl: "", enabled: false });
  const [annLoading, setAnnLoading] = useState(true);
  const [annSaving, setAnnSaving] = useState(false);

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
        if (data?.announcement) setAnn(data.announcement);
      } catch {
        toast({ title: "Failed to load announcement", variant: "error" });
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

  const saveAnnouncement = async () => {
    if (!ann.text.trim()) {
      toast({ title: "Announcement text is required", variant: "error" });
      return;
    }
    setAnnSaving(true);
    try {
      const r = await fetch("/api/admin/announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ann.text.trim(), linkUrl: ann.linkUrl.trim(), enabled: ann.enabled }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Save failed");
      if (data?.announcement) setAnn(data.announcement);
      toast({ title: "Announcement saved", description: ann.enabled ? "Live on the site now" : "Saved (currently disabled)", variant: "success" });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setAnnSaving(false);
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
        <p className="text-sm text-zinc-500 mt-1">Site-wide announcement bar and web push notifications.</p>
      </div>

      {/* ---------------- Announcement ---------------- */}
      <Card>
        <SectionHead
          icon={Megaphone}
          title="Announcement bar"
          desc="A slim banner shown at the very top of every page. Users can dismiss it; a new announcement shows again."
        />
        {annLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              label={`Announcement text (${ann.text.length}/200)`}
              value={ann.text}
              maxLength={200}
              onChange={(e) => setAnn((a) => ({ ...a, text: e.target.value }))}
              placeholder="e.g. New: AI Background Studio just launched — try it free"
            />
            <Input
              label="Link URL (optional)"
              value={ann.linkUrl}
              onChange={(e) => setAnn((a) => ({ ...a, linkUrl: e.target.value }))}
              placeholder="/tools/background-studio or https://…"
              hint="The whole bar becomes clickable. Leave empty for a non-clickable banner."
            />
            <div className="flex items-center gap-3">
              <Switch checked={ann.enabled} onChange={(v) => setAnn((a) => ({ ...a, enabled: v }))} label="Show announcement bar" />
              <span className="text-sm font-medium">{ann.enabled ? "Enabled" : "Disabled"}</span>
            </div>

            <div>
              <p className="text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Live preview</p>
              <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                <div className="flex w-full items-center gap-2 bg-gradient-to-r from-ember-600 via-magent-600 to-ember-600 px-4 py-2 text-white">
                  <Megaphone size={14} className="shrink-0" />
                  <span className="truncate text-[13px] font-medium">{ann.text || "Your announcement text appears here…"}</span>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 text-xs text-zinc-500">
                  {ann.linkUrl ? `Clicks through to ${ann.linkUrl}` : "No link — banner only"}
                </div>
              </div>
            </div>

            <Button onClick={saveAnnouncement} disabled={annSaving}>
              <Save size={16} className="mr-2" />
              {annSaving ? "Saving…" : "Save announcement"}
            </Button>
          </div>
        )}
      </Card>

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
