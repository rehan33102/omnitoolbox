"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Input, Textarea } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  deleteToolOverride,
  getToolOverrides,
  saveToolOverride,
  type ToolOverride,
} from "@/lib/tool-overrides";
import type { Tool, ToolCategory } from "@/types";

const emptyForm = {
  slug: "", title: "", tagline: "", description: "",
  category: "ai" as ToolCategory, href: "", icon: "Wand2",
  badge: "", image: "", keywords: "", sortOrder: 99, enabled: true,
};

type ToolForm = typeof emptyForm;

/** Merge API tools with local overrides (overrides win per-field). */
function mergeWithOverrides(tools: Tool[], overrides: Record<string, ToolOverride>): Tool[] {
  return tools.map((t) => {
    const o = overrides[t.slug];
    return o ? ({ ...t, ...o, slug: t.slug } as Tool) : t;
  });
}

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; form: ToolForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tool | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tools");
      const json = await res.json();
      const apiTools: Tool[] = json.tools ?? [];
      const overrides = await getToolOverrides();
      setTools(mergeWithOverrides(apiTools, overrides));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (slug: string, enabled: boolean) => {
    setTools((ts) => ts.map((t) => (t.slug === slug ? { ...t, enabled } : t)));
    // Local override so the homepage hides/shows the tool instantly.
    saveToolOverride(slug, { slug, enabled, updatedAt: new Date().toISOString() }).catch(() => {});
    const res = await fetch("/api/admin/tools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, enabled }),
    });
    if (!res.ok) {
      toast({ title: "Update failed", variant: "error" });
      load();
    }
  };

  const openEdit = (t: Tool) =>
    setModal({
      mode: "edit",
      form: {
        slug: t.slug, title: t.title, tagline: t.tagline, description: t.description,
        category: t.category, href: t.href, icon: t.icon,
        badge: t.badge ?? "", image: t.image ?? "", keywords: (t.keywords ?? []).join(", "),
        sortOrder: t.sortOrder, enabled: t.enabled,
      },
    });

  const remove = async () => {
    const t = deleteTarget;
    if (!t) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/tools?slug=${encodeURIComponent(t.slug)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      // Clear any local override so a later re-add starts clean.
      deleteToolOverride(t.slug).catch(() => {});
      toast({ title: "Tool deleted", variant: "success" });
      setDeleteTarget(null);
      load();
    } catch {
      toast({ title: "Delete failed", variant: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const { mode, form } = modal;
      const payload = {
        ...form,
        badge: form.badge || null,
        sortOrder: Number(form.sortOrder),
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 30),
      };
      const res = await fetch("/api/admin/tools", {
        method: mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      // Persist to IndexedDB + localStorage so the change shows on the site instantly,
      // even before the server cache refreshes.
      await saveToolOverride(form.slug, {
        slug: form.slug,
        title: form.title,
        tagline: form.tagline,
        description: form.description,
        category: form.category,
        href: form.href,
        icon: form.icon,
        badge: (form.badge || undefined) as Tool["badge"],
        image: form.image.trim() || undefined,
        keywords: payload.keywords,
        enabled: form.enabled,
        sortOrder: Number(form.sortOrder),
        updatedAt: new Date().toISOString(),
      });
      toast({ title: mode === "add" ? "Tool added" : "Tool updated", variant: "success" });
      setModal(null);
      load();
    } catch {
      toast({ title: "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof ToolForm>(k: K, v: ToolForm[K]) =>
    setModal((m) => (m ? { ...m, form: { ...m.form, [k]: v } } : m));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{tools.length} tools · toggles apply instantly</p>
        <Button size="sm" onClick={() => setModal({ mode: "add", form: emptyForm })}>
          <Plus size={14} /> Add tool
        </Button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {tools.map((t) => (
              <div key={t.slug} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{t.title}</p>
                    {t.badge && <Badge variant="new">{t.badge}</Badge>}
                    <Badge variant={t.category as "ai" | "image" | "social"}>{t.category}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">/{t.slug} → {t.href}</p>
                </div>
                <span className="text-xs text-zinc-500 font-mono hidden sm:block">#{t.sortOrder}</span>
                <button onClick={() => openEdit(t)} aria-label={`Edit ${t.title}`}
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition">
                  <Pencil size={15} className="text-zinc-600 dark:text-zinc-400" />
                </button>
                <button onClick={() => setDeleteTarget(t)} aria-label={`Delete ${t.title}`}
                  className="p-2 rounded-lg hover:bg-red-500/10 transition">
                  <Trash2 size={15} className="text-red-600 dark:text-red-400" />
                </button>
                <Switch checked={t.enabled} onChange={(v) => toggle(t.slug, v)} label={`Toggle ${t.title}`} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === "add" ? "Add new tool" : "Edit tool"}
        wide
      >
        {modal && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Slug" value={modal.form.slug} disabled={modal.mode === "edit"}
              onChange={(e) => set("slug", e.target.value)} hint="URL-safe, e.g. qr-generator" />
            <Input label="Title" value={modal.form.title} onChange={(e) => set("title", e.target.value)} />
            <Input label="Tagline" value={modal.form.tagline} onChange={(e) => set("tagline", e.target.value)} />
            <Input label="Link (href)" value={modal.form.href} onChange={(e) => set("href", e.target.value)} hint="/tools/my-tool" />
            <Input label="Image URL" value={modal.form.image} onChange={(e) => set("image", e.target.value)} hint="Card cover image (optional)" inputMode="url" />
            <div className="sm:col-span-2">
              <Input label="Keywords (comma separated)" value={modal.form.keywords} onChange={(e) => set("keywords", e.target.value)} hint="Search keywords — help users find this tool" />
            </div>
            <div className="sm:col-span-2">
              <Textarea label="Description" value={modal.form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Category</label>
              <select value={modal.form.category} onChange={(e) => set("category", e.target.value as ToolCategory)}
                className="input-base">
                {(["ai", "image", "social", "web", "text"] as ToolCategory[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Input label="Badge" value={modal.form.badge} onChange={(e) => set("badge", e.target.value)} hint="new / popular / pro (optional)" />
            <Input label="Sort order" type="number" value={modal.form.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value))} />
            <div className="flex items-center gap-3">
              <Switch checked={modal.form.enabled} onChange={(v) => set("enabled", v)} label="Enabled" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Enabled</span>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !modal.form.slug || !modal.form.title}>
                {saving ? "Saving…" : modal.mode === "add" ? "Add tool" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete tool?"
        message={deleteTarget ? `Delete "${deleteTarget.title}"? It will disappear from the site. You can re-add it later with the same slug.` : ""}
        onConfirm={remove}
        onClose={() => !deleting && setDeleteTarget(null)}
        busy={deleting}
      />
    </div>
  );
}
