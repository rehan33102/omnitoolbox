"use client";

import { useEffect, useState } from "react";
import { Globe, Share2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useSiteSettings } from "@/hooks/useSiteSettings";
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
