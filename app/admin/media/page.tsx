"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ImagePlus, Link2, Trash2, UploadCloud } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { formatBytes } from "@/lib/utils";
import type { MediaItem } from "@/app/api/admin/media/route";

export default function AdminMediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/media");
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast({ title: "Image uploaded", description: file.name, variant: "success" });
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Upload failed", variant: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUploading(true);
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add URL");
      toast({ title: "URL added", variant: "success" });
      setUrlInput("");
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to add URL", variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 1500);
      toast({ title: "URL copied", variant: "success" });
    } catch {
      toast({ title: "Copy failed", variant: "error" });
    }
  };

  const remove = async (item: MediaItem) => {
    if (!confirm(`Delete "${item.name}" from the media library?`)) return;
    const res = await fetch(`/api/admin/media?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Delete failed", variant: "error" });
      return;
    }
    toast({ title: "Deleted", variant: "success" });
    load(); // re-GET to confirm the delete stuck
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display font-semibold mb-1">Add media</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Upload an image (PNG, JPG, WebP, GIF, AVIF — max 2MB) or add a remote image URL.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <UploadCloud className="w-4 h-4" />
            {uploading ? "Working…" : "Upload image"}
          </Button>
          <div className="flex flex-1 gap-2">
            <Input
              placeholder="https://… image URL"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
            />
            <Button type="button" onClick={addUrl} disabled={uploading || !urlInput.trim()}>
              <Link2 className="w-4 h-4" />
              Add URL
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="font-display font-semibold mb-3">
          Library {items.length > 0 && <span className="text-sm font-normal text-zinc-500">({items.length})</span>}
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="text-center py-12 text-zinc-500">
            <ImagePlus className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No media yet — upload an image or add a URL above.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <Card key={item.id} className="p-2 group">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="px-1 pt-2 pb-1">
                  <p className="text-xs font-medium truncate" title={item.name}>{item.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {item.kind === "upload" ? formatBytes(item.size) : "remote URL"} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <div className="flex gap-1 mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => copyUrl(item)}
                      title="Copy URL"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === item.id ? "Copied" : "Copy URL"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => remove(item)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
