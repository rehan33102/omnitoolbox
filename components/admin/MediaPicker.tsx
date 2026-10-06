"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { formatBytes } from "@/lib/utils";
import type { MediaItem } from "@/app/api/admin/media/route";

/**
 * Reusable media picker dialog for admin forms (logo pickers, ad image pickers, …).
 * Props: { open, onClose, onSelect(url) }. Lists /api/admin/media, allows
 * uploading inside, and clicking an image selects its URL and closes.
 */
export default function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/media");
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      /* leave list empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const pick = (item: MediaItem) => {
    onSelect(item.url);
    onClose();
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast({ title: "Image uploaded", variant: "success" });
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
      setUrlInput("");
      load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to add URL", variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Choose image" wide>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
        <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <UploadCloud className="w-4 h-4" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="or paste image URL and press Enter"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addUrl()}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-zinc-500">
          <ImagePlus className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No images yet — upload one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 ring-2 ring-transparent hover:ring-brand-500 transition text-left"
              title={`Select ${item.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition">
                {item.name} · {item.kind === "upload" ? formatBytes(item.size) : "remote"}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
