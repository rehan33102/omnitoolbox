"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { AdConfig, AdType } from "@/types";

const TYPE_BADGE: Record<AdType, "ai" | "image" | "social"> = {
  adsense: "ai", banner: "image", affiliate: "social",
};

export default function AdminMonetizationPage() {
  const [ads, setAds] = useState<AdConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<AdType>("adsense");
  const [form, setForm] = useState({ placement: "", slotId: "", imageUrl: "", linkUrl: "", html: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ads");
      const json = await res.json();
      setAds(json.ads ?? []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (id: string, enabled: boolean) => {
    setAds((as) => as.map((a) => (a.id === id ? { ...a, enabled } : a)));
    await fetch("/api/admin/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this ad config?")) return;
    await fetch(`/api/admin/ads?id=${id}`, { method: "DELETE" });
    load();
  };

  const add = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...form }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Ad config added", variant: "success" });
      setForm({ placement: "", slotId: "", imageUrl: "", linkUrl: "", html: "" });
      load();
    } catch {
      toast({ title: "Failed to add", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display font-semibold mb-1">Add placement</h2>
        <p className="text-xs text-zinc-500 mb-4">Goes live immediately — no code deploy needed.</p>
        <Tabs defaultValue="adsense">
          <TabsList>
            <TabsTrigger value="adsense" onClick={() => setType("adsense")}>AdSense</TabsTrigger>
            <TabsTrigger value="banner" onClick={() => setType("banner")}>Banner</TabsTrigger>
            <TabsTrigger value="affiliate" onClick={() => setType("affiliate")}>Affiliate</TabsTrigger>
          </TabsList>
          <TabsContent value="adsense">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Placement" placeholder="homepage-hero" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} />
              <Input label="Ad Slot ID" placeholder="1234567890" value={form.slotId} onChange={(e) => setForm({ ...form, slotId: e.target.value })} />
            </div>
          </TabsContent>
          <TabsContent value="banner">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Placement" placeholder="sidebar" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} />
              <Input label="Image URL" placeholder="https://…" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
              <Input label="Link URL" placeholder="https://…" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
            </div>
          </TabsContent>
          <TabsContent value="affiliate">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Name / placement" placeholder="hosting-deal" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} />
              <Input label="Affiliate URL" placeholder="https://…?ref=…" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
              <div className="sm:col-span-2">
                <Input label="HTML / description" placeholder="Short promo text or custom HTML" value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <Button size="sm" className="mt-4" onClick={add} disabled={saving || !form.placement}>
          <Plus size={14} /> {saving ? "Adding…" : `Add ${type}`}
        </Button>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <p className="px-4 pt-4 pb-2 font-display font-semibold">Active placements</p>
        {loading ? (
          <div className="p-4 space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : ads.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No placements yet. Add your first one above.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {ads.map((a) => (
              <div key={a.id} className="flex items-center gap-4 p-4">
                <Badge variant={TYPE_BADGE[a.type]}>{a.type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.placement}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {[a.slotId && `slot ${a.slotId}`, a.linkUrl].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Switch checked={a.enabled} onChange={(v) => toggle(a.id, v)} label={`Toggle ${a.placement}`} />
                <button onClick={() => remove(a.id)} aria-label="Delete"
                  className="p-2 rounded-lg hover:bg-red-500/10 transition">
                  <Trash2 size={15} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display font-semibold mb-1">AdSense client</h2>
        <p className="text-xs text-zinc-500">
          Set via the <code className="text-zinc-300">NEXT_PUBLIC_ADSENSE_CLIENT_ID</code> env var on Vercel.
          Slot-level control above is fully dynamic.
        </p>
      </Card>
    </div>
  );
}
