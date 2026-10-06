"use client";

import { useEffect, useState } from "react";
import { Globe, Palette, Share2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { BRANDING_UPDATED_EVENT, DEFAULT_BRANDING, type Branding } from "@/hooks/useBranding";
import { normalizeWhatsapp, whatsappUrl } from "@/lib/site-settings";

export default function AdminSettingsPage() {
  const { settings, loaded, updateSettings } = useSiteSettings();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    siteName: "", tagline: "", logoText: "",
    whatsapp: "", instagram: "", tiktok: "", github: "",
  });

  useEffect(() => {
    if (loaded) {
      setForm({
        siteName: settings.siteName,
        tagline: settings.tagline,
        logoText: settings.logoText,
        whatsapp: settings.whatsapp,
        instagram: settings.instagram,
        tiktok: settings.tiktok,
        github: settings.github,
      });
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({
        siteName: form.siteName.trim() || settings.siteName,
        tagline: form.tagline.trim(),
        logoText: form.logoText.trim() || form.siteName.trim() || settings.siteName,
        whatsapp: normalizeWhatsapp(form.whatsapp),
        instagram: form.instagram.trim(),
        tiktok: form.tiktok.trim(),
        github: form.github.trim(),
      });
      toast({ title: "Settings saved", variant: "success", description: "Site updated instantly — no redeploy needed." });
    } catch {
      toast({ title: "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p className="text-sm text-zinc-500">Loading settings…</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <BrandingCard />
      <MaintenanceModeCard />

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-brand-700 dark:text-brand-400" />
          <h2 className="font-display font-bold">Site identity</h2>
        </div>
        <div className="space-y-4">
          <Input label="Website name" value={form.siteName} onChange={(e) => set("siteName", e.target.value)}
            hint="Shown in header, footer, copyright" />
          <Input label="Logo text" value={form.logoText} onChange={(e) => set("logoText", e.target.value)}
            hint="Text shown next to the logo icon" />
          <Textarea label="Tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} rows={2}
            hint="Short description shown in the footer" />
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Share2 size={16} className="text-brand-700 dark:text-brand-400" />
          <h2 className="font-display font-bold">Social links</h2>
        </div>
        <div className="space-y-4">
          <Input label="WhatsApp number" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)}
            placeholder="923407560964" hint="Digits only, with country code. Powers the floating button + footer."
            inputMode="tel" />
          <Input label="TikTok URL" value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)}
            placeholder="https://www.tiktok.com/@username" inputMode="url" />
          <Input label="Instagram URL" value={form.instagram} onChange={(e) => set("instagram", e.target.value)}
            placeholder="https://instagram.com/username" inputMode="url" />
          <Input label="GitHub URL" value={form.github} onChange={(e) => set("github", e.target.value)}
            placeholder="https://github.com/username" inputMode="url" />
          <p className="text-xs text-zinc-500">
            Preview:{" "}
            <a className="text-brand-700 dark:text-brand-400 underline" target="_blank" rel="noopener"
               href={whatsappUrl(normalizeWhatsapp(form.whatsapp))}>
              wa.me/{normalizeWhatsapp(form.whatsapp)}
            </a>
          </p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save all settings"}</Button>
      </div>
      <p className="text-xs text-zinc-500">
        Saved to IndexedDB + localStorage backup. Header, footer, contact page and the WhatsApp button update immediately on every page.
      </p>
    </div>
  );
}

/* ============================================================================
 * BRANDING CARD — Supabase-KV site branding (key `site_branding`).
 * Persists via PUT /api/branding; applies to ALL visitors immediately, no
 * redeploy. Separate from the IndexedDB-based site settings below.
 * ========================================================================== */

const LOGO_MAX_BYTES = 500 * 1024;
const FAVICON_MAX_BYTES = 100 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function BrandingCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [b, setB] = useState<Branding>({ ...DEFAULT_BRANDING });
  const [logoErr, setLogoErr] = useState("");
  const [faviconErr, setFaviconErr] = useState("");

  useEffect(() => {
    fetch("/api/branding", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setB({ ...DEFAULT_BRANDING, ...j });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof Branding, v: string) => setB((p) => ({ ...p, [k]: v }));

  const onFile = async (
    field: "logoUrl" | "faviconUrl",
    file: File | undefined,
    maxBytes: number,
    setErr: (s: string) => void
  ) => {
    setErr("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    if (file.size > maxBytes) {
      setErr(`Too large — max ${Math.round(maxBytes / 1024)}KB.`);
      return;
    }
    try {
      set(field, await readFileAsDataUrl(file));
    } catch {
      setErr("Could not read that file.");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Save failed");
      // Verify-after-write: re-read the authoritative value and confirm it
      // stuck. A silent revert (stale KV read) used to make this button look
      // broken — now a mismatch surfaces a loud error instead of a fake OK.
      const verify = await fetch(`/api/branding?t=${Date.now()}`, { cache: "no-store" });
      const saved = await verify.json().catch(() => null);
      const stuck =
        saved &&
        (saved.tagline ?? "") === (b.tagline ?? "") &&
        (saved.siteName ?? "") === (b.siteName ?? "") &&
        (saved.accentColor ?? "") === (b.accentColor ?? "");
      if (!stuck) {
        throw new Error("Save did not stick on the server — please try again.");
      }
      // Adopt the server truth (never trust the request echo alone).
      setB({ ...DEFAULT_BRANDING, ...saved });
      window.dispatchEvent(new CustomEvent<Branding>(BRANDING_UPDATED_EVENT, { detail: saved }));
      toast({
        title: "Branding saved",
        variant: "success",
        description: "Verified live for all visitors — header, footer and favicon update instantly.",
      });
    } catch (e) {
      toast({
        title: "Save failed",
        variant: "error",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-zinc-500">Loading branding…</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Palette size={16} className="text-brand-700 dark:text-brand-400" />
        <h2 className="font-display font-bold">Branding</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Stored in Supabase KV — applies to ALL visitors immediately, no redeploy. Empty fields fall back to the
        site-identity settings below.
      </p>

      <div className="space-y-4">
        <Input label="Site name" value={b.siteName} onChange={(e) => set("siteName", e.target.value)}
          placeholder="OmniToolBox" hint="Overrides the logo text in the header and the footer copyright." />
        <Input label="Tagline" value={b.tagline} onChange={(e) => set("tagline", e.target.value)}
          placeholder="Free online tools for everyone" hint="Shown under the site name." />

        {/* Logo */}
        <div>
          <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Logo image</span>
          <div className="flex items-center gap-3">
            {b.logoUrl ? (
              <img src={b.logoUrl} alt="Logo preview" className="h-12 w-12 rounded-xl object-cover border border-black/10 dark:border-white/10 shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-xl glass grid place-items-center text-xs text-zinc-400 shrink-0">—</div>
            )}
            <div className="flex-1 min-w-0">
              <Input aria-label="Logo image URL" value={b.logoUrl} onChange={(e) => set("logoUrl", e.target.value)}
                placeholder="https://… or paste a data:image/ URL" inputMode="url" />
              <input
                type="file"
                accept="image/*"
                aria-label="Upload logo image"
                className="mt-2 text-xs text-zinc-500 file:mr-2 file:rounded-lg file:border-0 file:bg-black/5 dark:file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-black/10 dark:hover:file:bg-white/20 file:cursor-pointer"
                onChange={(e) => onFile("logoUrl", e.target.files?.[0], LOGO_MAX_BYTES, setLogoErr)}
              />
            </div>
          </div>
          {logoErr && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{logoErr}</p>}
          <p className="text-xs text-zinc-500 mt-1.5">Replaces the logo mark in the header and footer. Upload max 500KB (stored as data URL).</p>
        </div>

        {/* Favicon */}
        <div>
          <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Favicon</span>
          <div className="flex items-center gap-3">
            {b.faviconUrl ? (
              <img src={b.faviconUrl} alt="Favicon preview" className="h-8 w-8 rounded-lg object-cover border border-black/10 dark:border-white/10 shrink-0 bg-white dark:bg-zinc-900" />
            ) : (
              <div className="h-8 w-8 rounded-lg glass grid place-items-center text-xs text-zinc-400 shrink-0">—</div>
            )}
            <div className="flex-1 min-w-0">
              <Input aria-label="Favicon URL" value={b.faviconUrl} onChange={(e) => set("faviconUrl", e.target.value)}
                placeholder="https://… or paste a data:image/ URL" inputMode="url" />
              <input
                type="file"
                accept="image/*"
                aria-label="Upload favicon"
                className="mt-2 text-xs text-zinc-500 file:mr-2 file:rounded-lg file:border-0 file:bg-black/5 dark:file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-black/10 dark:hover:file:bg-white/20 file:cursor-pointer"
                onChange={(e) => onFile("faviconUrl", e.target.files?.[0], FAVICON_MAX_BYTES, setFaviconErr)}
              />
            </div>
          </div>
          {faviconErr && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{faviconErr}</p>}
          <p className="text-xs text-zinc-500 mt-1.5">Browser tab icon. Upload max 100KB (stored as data URL).</p>
        </div>

        {/* Accent color */}
        <div>
          <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Accent color</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Pick accent color"
              value={/^#[0-9a-fA-F]{6}$/.test(b.accentColor) ? b.accentColor : "#8b5cf6"}
              onChange={(e) => set("accentColor", e.target.value)}
              className="h-10 w-14 rounded-xl cursor-pointer bg-transparent border border-black/10 dark:border-white/10 p-1"
            />
            <Input aria-label="Accent color hex" value={b.accentColor} onChange={(e) => set("accentColor", e.target.value)}
              placeholder="#8b5cf6" className="max-w-[140px] font-mono" />
            {b.accentColor && (
              <button
                type="button"
                onClick={() => set("accentColor", "")}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline underline-offset-2"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">
            {b.accentColor ? "Tint for the site-name gradient and text selection." : "Empty = default brand color (#8b5cf6)."}
          </p>
        </div>

        <Textarea label="Footer text" value={b.footerText} onChange={(e) => set("footerText", e.target.value)} rows={2}
          placeholder="Shown in the footer under the logo" hint="Overrides the site tagline in the footer." />

        <div className="space-y-4">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Social links <span className="text-xs font-normal text-zinc-500">(override the footer icons)</span></p>
          <Input label="X (Twitter) URL" value={b.socialX} onChange={(e) => set("socialX", e.target.value)}
            placeholder="https://x.com/username" inputMode="url" />
          <Input label="Instagram URL" value={b.socialInstagram} onChange={(e) => set("socialInstagram", e.target.value)}
            placeholder="https://instagram.com/username" inputMode="url" />
          <Input label="YouTube URL" value={b.socialYoutube} onChange={(e) => set("socialYoutube", e.target.value)}
            placeholder="https://youtube.com/@channel" inputMode="url" />
          <Input label="TikTok URL" value={b.socialTiktok} onChange={(e) => set("socialTiktok", e.target.value)}
            placeholder="https://www.tiktok.com/@username" inputMode="url" />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save branding"}</Button>
        </div>
      </div>
    </Card>
  );
}

/** Maintenance mode toggle — shows a site-wide "Website on maintenance" banner. */
function MaintenanceModeCard() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/maintenance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.enabled === "boolean") setEnabled(d.enabled);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Save failed");
      setEnabled(next);
      toast({
        title: next ? "Maintenance mode ON" : "Maintenance mode OFF",
        description: next
          ? "Visitors now see the maintenance banner."
          : "Banner removed from the site.",
        variant: "success",
      });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold">Maintenance mode</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Shows a site-wide &quot;Website on maintenance&quot; banner to all visitors.
            Turn it on while updating the site, off when done.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle maintenance mode"
          onClick={toggle}
          disabled={!loaded || saving}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
              enabled ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}
