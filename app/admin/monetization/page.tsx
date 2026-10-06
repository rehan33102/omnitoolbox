"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import Skeleton from "@/components/ui/Skeleton";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { PAGE_TARGETS } from "@/lib/ad-pages";
import {
  AD_ANIMATIONS,
  AD_ANIMATION_LABELS,
  AD_FREQUENCIES,
  AD_FREQUENCY_LABELS,
  AD_POSITIONS,
  AD_POSITION_LABELS,
  AD_BACKDROPS,
  AD_BACKDROP_LABELS,
  AD_DEVICES,
  AD_DEVICE_LABELS,
  AD_DEFAULTS,
  type AdAnimation,
  type AdFrequency,
  type AdPosition,
  type AdBackdrop,
  type AdDevices,
} from "@/lib/ad-options";
import type { AdConfig, AdType } from "@/types";

/* ------------------------------------------------------------------ */
/* Popup ads (KV-backed site_ads)                                       */
/* ------------------------------------------------------------------ */

interface SiteAd {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  animation: AdAnimation;
  durationSec: number;
  pages: string[];
  enabled: boolean;
  createdAt: string;
  // Optional — ads saved before these options existed lack them.
  showDelaySec?: number;
  frequency?: AdFrequency;
  position?: AdPosition;
  backdrop?: AdBackdrop;
  closeDelaySec?: number;
  devices?: AdDevices;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
}

const emptyPopupForm = {
  name: "",
  imageUrl: "",
  linkUrl: "",
  animation: "slide-up" as AdAnimation,
  durationSec: 30,
  pages: [] as string[],
  enabled: true,
  showDelaySec: AD_DEFAULTS.showDelaySec,
  frequency: AD_DEFAULTS.frequency,
  position: AD_DEFAULTS.position,
  backdrop: AD_DEFAULTS.backdrop,
  closeDelaySec: AD_DEFAULTS.closeDelaySec,
  devices: AD_DEFAULTS.devices,
  scheduleStart: "",
  scheduleEnd: "",
};

/** ISO datetime → "YYYY-MM-DDTHH:mm" for datetime-local inputs (local time). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Labeled <select> matching the admin form's visual style. */
function FieldSelect({ label, value, onChange, options, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <div>
      <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-base">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <span className="block text-xs text-zinc-500 mt-1.5">{hint}</span>}
    </div>
  );
}

const MAX_UPLOAD_BYTES = 1024 * 1024; // 1MB cap for uploaded images

export default function AdminMonetizationPage() {
  const { toast } = useToast();

  /* ---------------- popup ads state ---------------- */
  const [siteAds, setSiteAds] = useState<SiteAd[]>([]);
  const [siteAdsLoading, setSiteAdsLoading] = useState(true);
  const [popupForm, setPopupForm] = useState(emptyPopupForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [popupSaving, setPopupSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // In-app delete confirmation (native confirm() is auto-dismissed in
  // headless/automated browsers, making the button look dead).
  const [deletePopupTarget, setDeletePopupTarget] = useState<SiteAd | null>(null);
  const [deleteConfigTarget, setDeleteConfigTarget] = useState<AdConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ---------------- ad_configs (AdSense) state ---------------- */
  const [ads, setAds] = useState<AdConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<AdType>("adsense");
  const [form, setForm] = useState({ placement: "", slotId: "", imageUrl: "", linkUrl: "", html: "" });
  const [saving, setSaving] = useState(false);

  const TYPE_BADGE: Record<AdType, "ai" | "image" | "social"> = {
    adsense: "ai", banner: "image", affiliate: "social",
  };

  /* ---------------- loaders ---------------- */

  const loadSiteAds = async () => {
    setSiteAdsLoading(true);
    try {
      const res = await fetch("/api/admin/site-ads");
      const json = await res.json();
      setSiteAds(json.ads ?? []);
    } catch {
      toast({ title: "Failed to load popup ads", variant: "error" });
    } finally {
      setSiteAdsLoading(false);
    }
  };

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

  useEffect(() => { loadSiteAds(); load(); }, []);

  /* ---------------- popup ads actions ---------------- */

  const startEdit = (ad: SiteAd) => {
    setEditingId(ad.id);
    setPopupForm({
      name: ad.name,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl,
      animation: ad.animation,
      durationSec: ad.durationSec,
      pages: ad.pages ?? [],
      enabled: ad.enabled,
      showDelaySec: ad.showDelaySec ?? AD_DEFAULTS.showDelaySec,
      frequency: ad.frequency ?? AD_DEFAULTS.frequency,
      position: ad.position ?? AD_DEFAULTS.position,
      backdrop: ad.backdrop ?? AD_DEFAULTS.backdrop,
      closeDelaySec: ad.closeDelaySec ?? AD_DEFAULTS.closeDelaySec,
      devices: ad.devices ?? AD_DEFAULTS.devices,
      scheduleStart: toLocalInput(ad.scheduleStart),
      scheduleEnd: toLocalInput(ad.scheduleEnd),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setPopupForm(emptyPopupForm);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "error" });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ title: "Image too large — max 1MB", variant: "error" });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPopupForm((f) => ({ ...f, imageUrl: String(reader.result ?? "") }));
      setUploading(false);
      toast({ title: "Image uploaded", variant: "success" });
    };
    reader.onerror = () => {
      setUploading(false);
      toast({ title: "Failed to read image", variant: "error" });
    };
    reader.readAsDataURL(file);
  };

  const togglePage = (path: string) => {
    setPopupForm((f) => {
      const pages = f.pages.includes(path)
        ? f.pages.filter((p) => p !== path)
        : [...f.pages, path];
      return { ...f, pages };
    });
  };

  const savePopup = async () => {
    if (!popupForm.name.trim()) return toast({ title: "Name is required", variant: "error" });
    if (!/^https?:\/\/.+/.test(popupForm.imageUrl) && !/^data:image\/[a-zA-Z+]+;base64,/.test(popupForm.imageUrl))
      return toast({ title: "Image URL is invalid", variant: "error" });
    if (!/^https?:\/\/.+/.test(popupForm.linkUrl))
      return toast({ title: "Destination link must be an http(s) URL", variant: "error" });
    if (!Number.isInteger(popupForm.durationSec) || popupForm.durationSec < 5 || popupForm.durationSec > 600)
      return toast({ title: "Duration must be 5–600 seconds", variant: "error" });
    if (!Number.isInteger(popupForm.showDelaySec) || popupForm.showDelaySec < 0 || popupForm.showDelaySec > 300)
      return toast({ title: "Show delay must be 0–300 seconds", variant: "error" });
    if (!Number.isInteger(popupForm.closeDelaySec) || popupForm.closeDelaySec < 0 || popupForm.closeDelaySec > 120)
      return toast({ title: "Close delay must be 0–120 seconds", variant: "error" });
    const scheduleStart = popupForm.scheduleStart ? new Date(popupForm.scheduleStart).toISOString() : undefined;
    const scheduleEnd = popupForm.scheduleEnd ? new Date(popupForm.scheduleEnd).toISOString() : undefined;
    if (scheduleStart && Number.isNaN(Date.parse(scheduleStart)))
      return toast({ title: "Schedule start is not a valid date/time", variant: "error" });
    if (scheduleEnd && Number.isNaN(Date.parse(scheduleEnd)))
      return toast({ title: "Schedule end is not a valid date/time", variant: "error" });
    if (scheduleStart && scheduleEnd && Date.parse(scheduleEnd) <= Date.parse(scheduleStart))
      return toast({ title: "Schedule end must be after start", variant: "error" });

    setPopupSaving(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const payload = {
        ...popupForm,
        scheduleStart,
        scheduleEnd,
      };
      const body = editingId ? { id: editingId, ...payload } : payload;
      const res = await fetch("/api/admin/site-ads", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Save failed");
      toast({ title: editingId ? "Popup ad updated" : "Popup ad created", variant: "success" });
      cancelEdit();
      await loadSiteAds();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "error" });
    } finally {
      setPopupSaving(false);
    }
  };

  const toggleSiteAd = async (id: string, enabled: boolean) => {
    setSiteAds((as) => as.map((a) => (a.id === id ? { ...a, enabled } : a)));
    try {
      const res = await fetch("/api/admin/site-ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast({ title: "Failed to toggle", variant: "error" });
      loadSiteAds();
    }
  };

  const removeSiteAd = async () => {
    const target = deletePopupTarget;
    if (!target) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/site-ads?id=${encodeURIComponent(target.id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      const check = await fetch("/api/admin/site-ads");
      const list = await check.json().catch(() => ({}));
      if ((list.ads ?? []).some((a: SiteAd) => a.id === target.id)) {
        toast({ title: "Delete failed — still present", variant: "error" });
        return;
      }
      toast({ title: "Popup ad deleted", variant: "success" });
      setSiteAds(list.ads ?? []);
      setDeletePopupTarget(null);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Delete failed", variant: "error" });
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- ad_configs actions (AdSense placements) ---------------- */

  const toggle = async (id: string, enabled: boolean) => {
    setAds((as) => as.map((a) => (a.id === id ? { ...a, enabled } : a)));
    await fetch("/api/admin/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
  };

  /** Delete a placement. Verifies the API response and re-GETs the
   * list to confirm the row is actually gone before announcing success. */
  const remove = async () => {
    const target = deleteConfigTarget;
    if (!target) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/ads?id=${encodeURIComponent(target.id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      // Re-fetch and confirm the row is really gone.
      const check = await fetch("/api/admin/ads");
      const list = await check.json().catch(() => ({}));
      const remaining: AdConfig[] = list.ads ?? [];
      if (remaining.some((a) => a.id === target.id)) {
        toast({ title: "Delete failed — still present", variant: "error" });
        setAds(remaining);
        return;
      }
      toast({ title: "Ad config deleted", variant: "success" });
      setAds(remaining);
      setDeleteConfigTarget(null);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Delete failed", variant: "error" });
      load();
    } finally {
      setDeleting(false);
    }
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

  const allPages = popupForm.pages.length === 0;

  return (
    <div className="space-y-6">
      {/* ================= Section A: Popup ads ================= */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold">{editingId ? "Edit popup ad" : "Add popup ad"}</h2>
          {editingId && (
            <button onClick={cancelEdit} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Cancel edit">
              <X size={16} />
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Promo popup shown on the pages you pick, with your animation, timing and targeting. Goes live immediately — no code deploy needed.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Ad name" placeholder="Sponsor of the week" value={popupForm.name} onChange={(e) => setPopupForm({ ...popupForm, name: e.target.value })} />
          <Input label="Destination link" placeholder="https://…" value={popupForm.linkUrl} onChange={(e) => setPopupForm({ ...popupForm, linkUrl: e.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Image URL" placeholder="https://…/promo.png" value={popupForm.imageUrl.startsWith("data:") ? "" : popupForm.imageUrl} onChange={(e) => setPopupForm({ ...popupForm, imageUrl: e.target.value })} hint={popupForm.imageUrl.startsWith("data:") ? "Using uploaded image — replace below or paste a URL here." : undefined} />
            <div className="flex items-center gap-3 mt-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload size={14} /> {uploading ? "Uploading…" : "Upload image (max 1MB)"}
              </Button>
              {popupForm.imageUrl && (
                <button onClick={() => setPopupForm({ ...popupForm, imageUrl: "" })} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                  Remove image
                </button>
              )}
            </div>
            {popupForm.imageUrl && (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={popupForm.imageUrl} alt="Ad preview" className="max-h-40 rounded-lg ring-1 ring-black/10 dark:ring-white/10 object-contain" />
              </div>
            )}
          </div>
          {/* ---------- Animation & Style ---------- */}
          <div className="sm:col-span-2 mt-1">
            <h3 className="text-sm font-display font-semibold mb-2">Animation &amp; Style</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <FieldSelect
                label="Animation"
                value={popupForm.animation}
                onChange={(v) => setPopupForm({ ...popupForm, animation: v as AdAnimation })}
                options={AD_ANIMATIONS.map((a) => ({ value: a, label: AD_ANIMATION_LABELS[a] }))}
              />
              <FieldSelect
                label="Position"
                value={popupForm.position}
                onChange={(v) => setPopupForm({ ...popupForm, position: v as AdPosition })}
                options={AD_POSITIONS.map((p) => ({ value: p, label: AD_POSITION_LABELS[p] }))}
                hint="Corners render as a small card; center as a modal."
              />
              <FieldSelect
                label="Backdrop"
                value={popupForm.backdrop}
                onChange={(v) => setPopupForm({ ...popupForm, backdrop: v as AdBackdrop })}
                options={AD_BACKDROPS.map((b) => ({ value: b, label: AD_BACKDROP_LABELS[b] }))}
              />
            </div>
          </div>

          {/* ---------- Timing & Frequency ---------- */}
          <div className="sm:col-span-2 mt-1">
            <h3 className="text-sm font-display font-semibold mb-2">Timing &amp; Frequency</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Auto-dismiss (seconds)" type="number" min={5} max={600} value={popupForm.durationSec}
                onChange={(e) => setPopupForm({ ...popupForm, durationSec: Number(e.target.value) || 0 })} />
              <FieldSelect
                label="Frequency"
                value={popupForm.frequency}
                onChange={(v) => setPopupForm({ ...popupForm, frequency: v as AdFrequency })}
                options={AD_FREQUENCIES.map((f) => ({ value: f, label: AD_FREQUENCY_LABELS[f] }))}
                hint="Once per session = X dismisses for the session. Every page view = shows each load."
              />
              <Input label="Show delay (seconds)" type="number" min={0} max={300} value={popupForm.showDelaySec}
                hint="Wait after page load before showing. 0 = immediate."
                onChange={(e) => setPopupForm({ ...popupForm, showDelaySec: Math.max(0, Number(e.target.value) || 0) })} />
              <Input label="Close delay (seconds)" type="number" min={0} max={120} value={popupForm.closeDelaySec}
                hint="Hide the X button until this long passes. 0 = immediate."
                onChange={(e) => setPopupForm({ ...popupForm, closeDelaySec: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
          </div>
        </div>

        {/* ---------- Targeting ---------- */}
        <div className="mt-4">
          <h3 className="text-sm font-display font-semibold mb-2">Targeting</h3>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <FieldSelect
              label="Devices"
              value={popupForm.devices}
              onChange={(v) => setPopupForm({ ...popupForm, devices: v as AdDevices })}
              options={AD_DEVICES.map((d) => ({ value: d, label: AD_DEVICE_LABELS[d] }))}
            />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Show on pages</span>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={allPages}
                onChange={(e) => setPopupForm({ ...popupForm, pages: e.target.checked ? [] : ["/"] })}
                className="h-4 w-4 accent-current"
              />
              All pages
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PAGE_TARGETS.map((p) => {
              const checked = allPages || popupForm.pages.includes(p.path);
              return (
                <label key={p.path} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={allPages}
                    onChange={() => togglePage(p.path)}
                    className="h-4 w-4 accent-current"
                  />
                  <span className={allPages ? "opacity-60" : ""}>{p.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ---------- Schedule ---------- */}
        <div className="mt-4">
          <h3 className="text-sm font-display font-semibold mb-2">Schedule</h3>
          <p className="text-xs text-zinc-500 mb-2">
            Optional — the ad only shows inside this window. Leave both empty for no schedule.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Start" type="datetime-local" value={popupForm.scheduleStart}
              onChange={(e) => setPopupForm({ ...popupForm, scheduleStart: e.target.value })} />
            <Input label="End" type="datetime-local" value={popupForm.scheduleEnd}
              onChange={(e) => setPopupForm({ ...popupForm, scheduleEnd: e.target.value })} />
          </div>
          {(popupForm.scheduleStart || popupForm.scheduleEnd) && (
            <button
              onClick={() => setPopupForm({ ...popupForm, scheduleStart: "", scheduleEnd: "" })}
              className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Clear schedule
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <Button size="sm" onClick={savePopup} disabled={popupSaving}>
            {editingId ? <Pencil size={14} /> : <Plus size={14} />}
            {popupSaving ? "Saving…" : editingId ? "Save changes" : "Add popup ad"}
          </Button>
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Switch checked={popupForm.enabled} onChange={(v) => setPopupForm({ ...popupForm, enabled: v })} label="Enable popup ad" />
            Enabled
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <p className="px-4 pt-4 pb-2 font-display font-semibold">Popup ads</p>
        {siteAdsLoading ? (
          <div className="p-4 space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : siteAds.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No popup ads yet. Create your first one above.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {siteAds.map((a) => (
              <div key={a.id} className="flex items-center gap-4 p-4">
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {AD_ANIMATION_LABELS[a.animation] ?? a.animation} · {a.durationSec}s · {AD_FREQUENCY_LABELS[a.frequency ?? "session"]} · {AD_POSITION_LABELS[a.position ?? "center"]} · {a.pages.length === 0 ? "all pages" : `${a.pages.length} page${a.pages.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <Switch checked={a.enabled} onChange={(v) => toggleSiteAd(a.id, v)} label={`Toggle ${a.name}`} />
                <button onClick={() => startEdit(a)} aria-label="Edit"
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition">
                  <Pencil size={15} className="text-zinc-500" />
                </button>
                <button onClick={() => setDeletePopupTarget(a)} aria-label="Delete"
                  className="p-2 rounded-lg hover:bg-red-500/10 transition">
                  <Trash2 size={15} className="text-red-600 dark:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ================= Section B: AdSense placements ================= */}
      <div className="pt-2">
        <h2 className="font-display font-semibold text-lg mb-1">AdSense placements</h2>
        <p className="text-xs text-zinc-500 mb-4">Slot-level AdSense, banner and affiliate placements.</p>
      </div>

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
          <div className="divide-y divide-black/5 dark:divide-white/5">
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
                <button onClick={() => setDeleteConfigTarget(a)} aria-label="Delete"
                  className="p-2 rounded-lg hover:bg-red-500/10 transition">
                  <Trash2 size={15} className="text-red-600 dark:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display font-semibold mb-1">AdSense client</h2>
        <p className="text-xs text-zinc-500">
          Set via the <code className="text-zinc-700 dark:text-zinc-300">NEXT_PUBLIC_ADSENSE_CLIENT_ID</code> env var on Vercel.
          Slot-level control above is fully dynamic.
        </p>
      </Card>

      <ConfirmModal
        open={!!deletePopupTarget}
        title="Delete popup ad?"
        message={deletePopupTarget ? `Delete popup ad "${deletePopupTarget.name}"? It will stop showing on the site immediately.` : ""}
        onConfirm={removeSiteAd}
        onClose={() => !deleting && setDeletePopupTarget(null)}
        busy={deleting}
      />
      <ConfirmModal
        open={!!deleteConfigTarget}
        title="Delete ad placement?"
        message={deleteConfigTarget ? `Delete the "${deleteConfigTarget.placement}" placement?` : ""}
        onConfirm={remove}
        onClose={() => !deleting && setDeleteConfigTarget(null)}
        busy={deleting}
      />
    </div>
  );
}
