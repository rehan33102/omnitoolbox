"use client";

import { useCallback, useRef, useState } from "react";
import { ClipboardPaste, Download, Link2, Loader2, SearchX, Youtube } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import JsonLd from "@/components/seo/JsonLd";

/** Client-safe FAQPage JSON-LD (lib/seo.ts is server-only). */
function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

type Quality = {
  key: string;
  label: string;
  file: string;
  width: number;
  height: number;
  note: string;
};

const QUALITIES: Quality[] = [
  { key: "maxres", label: "Full HD", file: "maxresdefault.jpg", width: 1280, height: 720, note: "Best quality — only exists when the uploader set a custom HD thumbnail" },
  { key: "sd", label: "SD", file: "sddefault.jpg", width: 640, height: 480, note: "Standard definition" },
  { key: "hq", label: "HQ", file: "hqdefault.jpg", width: 480, height: 360, note: "Always available for every public video" },
  { key: "mq", label: "MQ", file: "mqdefault.jpg", width: 320, height: 180, note: "Clean 16:9, good for listings and embeds" },
];

/** Extract the 11-char video ID from every common YouTube URL shape. */
export function extractVideoId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  // Bare ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtube\.com\/watch\/|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/live\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = v.match(p);
    if (m) return m[1];
  }
  return null;
}

type ThumbState = {
  quality: Quality;
  url: string;
  available: boolean | null; // null = probing
};

const FAQS = [
  {
    question: "How do I download a YouTube thumbnail?",
    answer:
      "Copy the YouTube video URL, paste it into the downloader above and press Extract. Pick a size (Full HD 1280×720 recommended) and press Download. The image saves straight to your device — no signup, no software, no watermark.",
  },
  {
    question: "What is the highest thumbnail resolution YouTube provides?",
    answer:
      "1280×720 (Full HD) via maxresdefault.jpg — but only when the uploader uploaded a custom HD thumbnail. If it does not exist for a video, use the SD 640×480 version instead. Any site offering a '4K thumbnail' is upscaling the image, not serving a real 4K source file.",
  },
  {
    question: "Does this work with YouTube Shorts?",
    answer:
      "Yes. Paste a youtube.com/shorts/ link or a youtu.be short link — the tool extracts the same thumbnail set. Shorts thumbnails are the same 16:9 images YouTube generates for every upload.",
  },
  {
    question: "Is it legal to download YouTube thumbnails?",
    answer:
      "Downloading for personal use, research, reference or education is generally fine. Reusing someone else's thumbnail commercially without permission can infringe copyright — always get the creator's consent before publishing their artwork as your own.",
  },
  {
    question: "Do I need to install anything or create an account?",
    answer:
      "No. The downloader runs entirely in your browser. Thumbnails come straight from YouTube's public image servers (i.ytimg.com) to your device — nothing is uploaded anywhere.",
  },
  {
    question: "Why is the Full HD option missing for some videos?",
    answer:
      "YouTube only generates maxresdefault.jpg when the uploader provided a high-resolution custom thumbnail. Older videos or videos without a custom thumbnail only have SD/HQ/MQ versions. The tool automatically detects this and hides the HD option.",
  },
  {
    question: "Can I download thumbnails from private or deleted videos?",
    answer:
      "No. Private and deleted videos have no publicly accessible thumbnails. Unlisted videos work if you have the URL. Age-restricted videos may return fewer sizes.",
  },
];

export default function YoutubeThumbnailDownloader() {
  const [input, setInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [thumbs, setThumbs] = useState<ThumbState[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const probeImage = (url: string): Promise<boolean> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 120); // 120px grey = placeholder
      img.onerror = () => resolve(false);
      img.src = url;
      setTimeout(() => resolve(false), 12000);
    });

  const extract = useCallback(async () => {
    abortRef.current?.abort();
    const id = extractVideoId(input);
    if (!id) {
      setError("That does not look like a YouTube URL. Paste a watch, youtu.be, Shorts or embed link — or the 11-character video ID.");
      setVideoId(null);
      setThumbs([]);
      return;
    }
    setError("");
    setBusy(true);
    setVideoId(id);
    setTitle("");
    setAuthor("");
    const controller = new AbortController();
    abortRef.current = controller;

    // Video title/author via oEmbed (best-effort)
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && !controller.signal.aborted) {
          setTitle(d.title || "");
          setAuthor(d.author_name || "");
        }
      })
      .catch(() => {});

    // Probe qualities (maxres may not exist)
    const states: ThumbState[] = QUALITIES.map((q) => ({
      quality: q,
      url: `https://i.ytimg.com/vi/${id}/${q.file}`,
      available: q.key === "maxres" ? null : true,
    }));
    setThumbs(states);
    const maxOk = await probeImage(states[0].url);
    if (controller.signal.aborted) return;
    setThumbs((prev) =>
      prev.map((t) => (t.quality.key === "maxres" ? { ...t, available: maxOk } : t))
    );
    setBusy(false);
  }, [input]);

  const fileName = (q: Quality) => {
    const base = (title || "youtube-thumbnail")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return `${base || "youtube-thumbnail"}-${q.key}-${q.width}x${q.height}.jpg`;
  };

  const download = async (t: ThumbState) => {
    setDownloading(t.quality.key);
    try {
      const res = await fetch(t.url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = fileName(t.quality);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 5000);
      toast({ title: "Thumbnail downloaded", variant: "success", description: `${t.quality.label} · ${t.quality.width}×${t.quality.height}` });
    } catch {
      // Fallback: open in a new tab so the user can long-press / right-click save
      window.open(t.url, "_blank", "noopener");
      toast({ title: "Opened in new tab", variant: "info", description: "Long-press or right-click the image to save it." });
    } finally {
      setDownloading(null);
    }
  };

  const copyLink = async (t: ThumbState) => {
    try {
      await navigator.clipboard.writeText(t.url);
      toast({ title: "Link copied", variant: "success", description: "Thumbnail URL is on your clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "error", description: "Your browser blocked clipboard access." });
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text.trim());
        toast({ title: "Pasted", variant: "success", description: "Press Extract to fetch the thumbnails." });
      }
    } catch {
      toast({ title: "Clipboard blocked", variant: "error", description: "Paste the URL manually instead." });
    }
  };

  return (
    <div>
      <JsonLd data={faqJsonLd(FAQS)} />

      {/* Tool UI */}
      <Card className="p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && extract()}
              placeholder="Paste a YouTube URL — watch, youtu.be, Shorts, embed…"
              className="pl-10"
              aria-label="YouTube video URL"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={pasteFromClipboard} aria-label="Paste from clipboard">
              <ClipboardPaste className="w-4 h-4" />
            </Button>
            <Button onClick={extract} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Extract"}
            </Button>
          </div>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
            <SearchX className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {videoId && (
          <div className="mt-6">
            {(title || busy) && (
              <div className="mb-4">
                <p className="font-semibold leading-snug">{title || "Loading video info…"}</p>
                {author && <p className="text-sm text-zinc-500">by {author}</p>}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              {thumbs
                .filter((t) => t.available !== false)
                .map((t) => (
                  <div
                    key={t.quality.key}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                  >
                    <div className="relative bg-zinc-100 dark:bg-zinc-900 aspect-video grid place-items-center">
                      {t.available === null ? (
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                      ) : (
                        <img
                          src={t.url}
                          alt={`YouTube thumbnail ${t.quality.label} ${t.quality.width}x${t.quality.height}`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      )}
                      <span className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-white">
                        {t.quality.label} · {t.quality.width}×{t.quality.height}
                      </span>
                    </div>
                    <div className="p-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => download(t)}
                        disabled={downloading === t.quality.key || t.available === null}
                      >
                        {downloading === t.quality.key ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Download
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => copyLink(t)} aria-label="Copy thumbnail link">
                        <Link2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Tip: use thumbnails for research and reference. For commercial reuse, get the creator&apos;s permission.
            </p>
          </div>
        )}
      </Card>

      {/* SEO content */}
      <article className="max-w-3xl">
        <h2 className="font-display text-2xl font-bold mb-3">Download any YouTube thumbnail in HD — free</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Every YouTube video ships with a set of thumbnail images stored on YouTube&apos;s public image servers at
          resolutions from 120×90 up to Full HD 1280×720. This free YouTube thumbnail downloader reads the video ID
          from any link — watch pages, youtu.be short links, Shorts, embeds and live streams — and hands you every
          available size with a one-click download. No signup, no software, no watermark. The images travel straight
          from YouTube&apos;s servers to your browser; nothing you paste ever leaves your device.
        </p>
        <h3 className="font-display text-xl font-bold mt-6 mb-3">How to save a YouTube thumbnail in 3 steps</h3>
        <ol className="list-decimal pl-5 space-y-2 text-zinc-600 dark:text-zinc-400 mb-4">
          <li><strong>Copy the video link.</strong> On YouTube, tap Share → Copy link, or copy the URL from your browser&apos;s address bar. Shorts links work too.</li>
          <li><strong>Paste it above and press Extract.</strong> The tool pulls the video&apos;s title and lists every thumbnail size YouTube generated — Full HD, SD, HQ and MQ.</li>
          <li><strong>Download your size.</strong> Pick Full HD 1280×720 for design work and competitor research, or a smaller size for quick reference. The file saves instantly.</li>
        </ol>
        <h3 className="font-display text-xl font-bold mt-6 mb-3">Why creators download thumbnails</h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Around 90% of the best-performing videos on YouTube use custom thumbnails, which makes them the single
          richest public library of proven click-driving design on the internet. Creators study competitors&apos;
          thumbnails to learn what works — color contrast, facial expressions, text placement — before designing
          their own. Designers grab them as mockup placeholders, educators use them in presentations, and archivists
          keep them as visual references for video collections. Whatever your reason, getting the clean original file
          beats screenshotting and cropping every time.
        </p>
        <h3 className="font-display text-xl font-bold mt-6 mb-3">Thumbnail sizes explained</h3>
        <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-400 mb-4">
          <li><strong>Full HD 1280×720</strong> — the original custom thumbnail. Only exists when the uploader supplied a high-resolution image.</li>
          <li><strong>SD 640×480</strong> — reliable fallback with the classic YouTube look.</li>
          <li><strong>HQ 480×360</strong> — generated for every public video, always available.</li>
          <li><strong>MQ 320×180</strong> — clean 16:9 crop, handy for lists and embeds.</li>
        </ul>
        <h3 className="font-display text-xl font-bold mt-6 mb-3">Frequently asked questions</h3>
        <div className="space-y-4">
          {FAQS.map((f) => (
            <div key={f.question} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="font-semibold mb-1.5">{f.question}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{f.answer}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
