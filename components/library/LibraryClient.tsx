"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Download, FolderOpen, ImagePlus, Loader2, Mic, Play, QrCode,
  Square, Trash2, LibraryBig, Sparkles,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { deleteBlob, getBlob, listByKind, listBlobKinds, clearKind, type BlobMeta } from "@/lib/db";
import { cn } from "@/lib/utils";

type GroupDef = {
  kind: string;
  title: string;
  blurb: string;
  icon: typeof Mic;
  /** show play button (audio kinds) */
  audio?: boolean;
  /** show image thumbnail */
  thumb?: boolean;
  /** link to the tool that produces these */
  toolHref: string;
  toolLabel: string;
};

const GROUPS: GroupDef[] = [
  {
    kind: "voiceover", title: "Voiceovers", blurb: "Generated MP3 voiceovers", icon: Mic,
    audio: true, toolHref: "/ai-voiceover", toolLabel: "Open Voiceover Studio",
  },
  {
    kind: "qr", title: "QR codes", blurb: "Generated QR code images", icon: QrCode,
    thumb: true, toolHref: "/web-tools", toolLabel: "Open QR Generator",
  },
  {
    kind: "image", title: "Images", blurb: "Converted images", icon: ImagePlus,
    thumb: true, toolHref: "/media-tools", toolLabel: "Open Image Converter",
  },
];

function downloadUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function GroupSection({ group, onCount }: { group: GroupDef; onCount?: (kind: string, n: number) => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<BlobMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio() : null));
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listByKind(group.kind, 200);
    setItems(list);
    onCount?.(group.kind, list.length);
    setLoading(false);
    if (group.thumb) {
      const map: Record<string, string> = {};
      for (const it of list.slice(0, 24)) {
        const entry = await getBlob(it.id);
        if (entry) map[it.id] = URL.createObjectURL(entry.blob);
      }
      setThumbs(map);
    }
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => {
    audio?.pause();
    Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = async (it: BlobMeta) => {
    if (!audio) return;
    if (playingId === it.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    const entry = await getBlob(it.id);
    if (!entry) {
      toast({ title: "Audio not found", variant: "error", description: "This file was cleared from the device." });
      return;
    }
    audio.pause();
    audio.src = URL.createObjectURL(entry.blob);
    audio.onended = () => setPlayingId(null);
    setPlayingId(it.id);
    audio.play().catch(() => setPlayingId(null));
  };

  const download = async (it: BlobMeta) => {
    const entry = await getBlob(it.id);
    if (!entry) {
      toast({ title: "File not found", variant: "error" });
      return;
    }
    const url = URL.createObjectURL(entry.blob);
    downloadUrl(url, it.name || `file-${it.id}`);
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };

  const remove = async (it: BlobMeta) => {
    await deleteBlob(it.id);
    if (playingId === it.id) {
      audio?.pause();
      setPlayingId(null);
    }
    setItems((xs) => xs.filter((x) => x.id !== it.id));
    toast({ title: "Deleted", variant: "success" });
  };

  const clearAll = async () => {
    await clearKind(group.kind);
    audio?.pause();
    setPlayingId(null);
    setItems([]);
    setThumbs({});
  };

  const Icon = group.icon;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Icon size={17} className="text-brand-700 dark:text-brand-400" />
          {group.title}
          <span className="text-xs font-normal text-zinc-500">({items.length})</span>
        </h3>
        {items.length > 0 && (
          <button onClick={clearAll} className="text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition">
            Clear all
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <FolderOpen size={30} className="mx-auto mb-2 text-zinc-600" />
          <p className="text-sm">Nothing saved yet</p>
          <Link href={group.toolHref} className="text-xs text-brand-700 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 mt-1 inline-block">
            {group.toolLabel} →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/5 p-3 flex items-center gap-3">
              {group.audio ? (
                <button
                  onClick={() => togglePlay(it)}
                  className="grid place-items-center size-9 rounded-full bg-brand-500/20 border border-brand-500/30 shrink-0"
                  aria-label={playingId === it.id ? "Pause" : "Play"}
                >
                  {playingId === it.id
                    ? <Square size={14} className="text-brand-700 dark:text-brand-300" />
                    : <Play size={14} className="text-brand-700 dark:text-brand-300" />}
                </button>
              ) : group.thumb && thumbs[it.id] ? (
                <img src={thumbs[it.id]} alt="" className="size-11 rounded-lg object-cover shrink-0 border border-black/10 dark:border-white/10" />
              ) : (
                <span className="grid place-items-center size-9 rounded-xl bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 shrink-0">
                  <Icon size={16} className="text-zinc-600 dark:text-zinc-400" />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{it.name || it.id}</p>
                <p className="text-[11px] text-zinc-500">
                  {new Date(it.createdAt).toLocaleDateString()} · {new Date(it.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {it.meta && typeof it.meta.text === "string" ? ` · ${it.meta.text}` : ""}
                </p>
              </div>
              <button onClick={() => download(it)} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-300 transition" aria-label="Download">
                <Download size={15} />
              </button>
              <button onClick={() => remove(it)} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition" aria-label="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-zinc-600">{group.blurb} · saved automatically when you generate them.</p>
    </Card>
  );
}

export default function LibraryClient() {
  const [otherKinds, setOtherKinds] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const onCount = useCallback((kind: string, n: number) => {
    setCounts((c) => (c[kind] === n ? c : { ...c, [kind]: n }));
  }, []);

  useEffect(() => {
    listBlobKinds().then((kinds) => {
      setOtherKinds(kinds.filter((k) => !GROUPS.some((g) => g.kind === k)));
    });
  }, []);

  const allKinds = [...GROUPS.map((g) => g.kind), ...otherKinds];
  const total = allKinds.reduce((a, k) => a + (counts[k] ?? 0), 0);
  const loaded = allKinds.every((k) => counts[k] !== undefined);

  return (
    <div className="space-y-5">
      {GROUPS.map((g) => (
        <GroupSection key={g.kind} group={g} onCount={onCount} />
      ))}

      {otherKinds.length > 0 &&
        otherKinds.map((kind) => (
          <GroupSection
            key={kind}
            onCount={onCount}
            group={{
              kind,
              title: kind.charAt(0).toUpperCase() + kind.slice(1),
              blurb: `Saved ${kind} files`,
              icon: LibraryBig,
              toolHref: "/",
              toolLabel: "Browse tools",
            }}
          />
        ))}

      {loaded && total === 0 && (
        <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 p-8 text-center">
          <Sparkles size={26} className="mx-auto mb-3 text-brand-700 dark:text-brand-400" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Your library fills up as you create</p>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Generate a voiceover, a QR code, or convert an image — it lands here automatically.
          </p>
          <div className={cn("flex flex-wrap justify-center gap-2")}>
            <Link href="/ai-voiceover"><Button size="sm"><Mic size={14} /> Voiceover Studio</Button></Link>
            <Link href="/web-tools"><Button size="sm" variant="secondary"><QrCode size={14} /> QR Generator</Button></Link>
            <Link href="/media-tools"><Button size="sm" variant="secondary"><ImagePlus size={14} /> Image Converter</Button></Link>
          </div>
        </div>
      )}
    </div>
  );
}
