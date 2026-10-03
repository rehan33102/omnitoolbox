"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  allBlogPostsForAdmin,
  deleteAdminPost,
  getAdminPost,
  saveAdminPost,
  slugifyTitle,
} from "@/lib/admin-blog";
import { useAdminBlogPosts } from "@/hooks/useAdminBlogPosts";
import { BLOG_SEED } from "@/data/blog-templates";
import type { BlogPost } from "@/types";

const emptyForm = {
  title: "", slug: "", excerpt: "", tags: "", body: "",
  readingMinutes: 5, published: true,
};
type BlogForm = typeof emptyForm;

function seedSlugs(): Set<string> {
  return new Set(BLOG_SEED.map((p) => p.slug));
}

export default function AdminBlogPage() {
  const { posts: adminPosts, loaded, reload } = useAdminBlogPosts();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; form: BlogForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const seeds = seedSlugs();

  const rows = allBlogPostsForAdmin(adminPosts);
  const adminSlugs = new Set(adminPosts.map((p) => p.slug));

  const openEdit = async (p: BlogPost) => {
    const admin = await getAdminPost(p.slug);
    const src = admin ?? p;
    setModal({
      mode: "edit",
      form: {
        title: src.title, slug: src.slug, excerpt: src.excerpt,
        tags: src.tags.join(", "), body: src.body,
        readingMinutes: src.readingMinutes, published: !!src.publishedAt,
      },
    });
  };

  const openAdd = () => setModal({ mode: "add", form: { ...emptyForm } });

  const save = async () => {
    if (!modal) return;
    const { form } = modal;
    const slug = slugifyTitle(form.slug || form.title);
    if (!slug || !form.title.trim() || !form.body.trim()) {
      toast({ title: "Title, slug and body are required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const post: BlogPost = {
        id: modal.mode === "edit" && adminSlugs.has(slug)
          ? (adminPosts.find((p) => p.slug === slug)?.id ?? slug)
          : slug,
        slug,
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || form.title.trim(),
        body: form.body,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        readingMinutes: Math.max(1, Number(form.readingMinutes) || 5),
        publishedAt: form.published ? now : null,
        updatedAt: now,
      };
      await saveAdminPost(post);
      await reload();
      toast({ title: form.published ? "Post published" : "Draft saved", variant: "success" });
      setModal(null);
    } catch {
      toast({ title: "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: BlogPost) => {
    if (!adminSlugs.has(p.slug)) return;
    if (!confirm(`Delete "${p.title}"?${seeds.has(p.slug) ? " The built-in version will be restored." : ""}`)) return;
    await deleteAdminPost(p.slug);
    await reload();
    toast({ title: "Deleted", variant: "success" });
  };

  const set = <K extends keyof BlogForm>(k: K, v: BlogForm[K]) =>
    setModal((m) => {
      if (!m) return m;
      const form = { ...m.form, [k]: v };
      // Auto-slug from title while adding.
      if (m.mode === "add" && k === "title") form.slug = slugifyTitle(v as string);
      return { ...m, form };
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{rows.length} posts · publishing goes live instantly</p>
        <Button size="sm" onClick={openAdd}>
          <Plus size={14} /> New post
        </Button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {!loaded ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {rows.map((p) => {
              const isCustom = adminSlugs.has(p.slug) && !seeds.has(p.slug);
              const isOverridden = adminSlugs.has(p.slug) && seeds.has(p.slug);
              return (
                <div key={p.slug} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{p.title}</p>
                      {p.publishedAt
                        ? <Badge variant="new">Live</Badge>
                        : <Badge variant="ai">Draft</Badge>}
                      {isCustom && <Badge variant="pro">Custom</Badge>}
                      {isOverridden && <Badge variant="ai">Edited</Badge>}
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">/blog/{p.slug}</p>
                  </div>
                  <button onClick={() => openEdit(p)} aria-label={`Edit ${p.title}`}
                    className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition">
                    <Pencil size={15} className="text-zinc-600 dark:text-zinc-400" />
                  </button>
                  {adminSlugs.has(p.slug) && (
                    <button onClick={() => remove(p)} aria-label={`Delete ${p.title}`}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition">
                      <Trash2 size={15} className="text-red-600 dark:text-red-400" />
                    </button>
                  )}
                </div>
              );
            })}
            {rows.length === 0 && <p className="p-6 text-sm text-zinc-500 text-center">No posts yet.</p>}
          </div>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal?.mode === "add" ? "New blog post" : "Edit blog post"} wide>
        {modal && (
          <div className="grid gap-4">
            <Input label="Title" value={modal.form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="How to Remove Image Backgrounds Free" />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Slug" value={modal.form.slug} onChange={(e) => set("slug", e.target.value)}
                hint="/blog/ + slug" disabled={modal.mode === "edit"} />
              <Input label="Reading minutes" type="number" value={modal.form.readingMinutes}
                onChange={(e) => set("readingMinutes", Number(e.target.value))} />
            </div>
            <Input label="Excerpt" value={modal.form.excerpt} onChange={(e) => set("excerpt", e.target.value)}
              hint="Shown on cards + SEO meta description" />
            <Input label="Tags (comma separated)" value={modal.form.tags}
              onChange={(e) => set("tags", e.target.value)} placeholder="image tools, tutorial, free" />
            <Textarea label="Body (Markdown)" value={modal.form.body}
              onChange={(e) => set("body", e.target.value)} rows={14}
              hint="## headings, - bullets, **bold**, `code` supported" />
            <div className="flex items-center gap-3">
              <Switch checked={modal.form.published}
                onChange={(v) => set("published", v)} label="Published" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {modal.form.published ? "Live on /blog immediately" : "Saved as draft (hidden)"}
              </span>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !modal.form.title.trim()}>
                {saving ? "Saving…" : modal.mode === "add" ? "Publish post" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <p className="text-xs text-zinc-500">
        Posts are stored in IndexedDB + localStorage backup and merged over the built-in articles —
        publishing shows the post on /blog instantly, no redeploy.
      </p>
    </div>
  );
}
