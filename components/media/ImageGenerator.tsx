"use client";

/**
 * AI Image Generator — powered by Pollinations.ai (FREE, no API key).
 * Type a prompt → pick a style, size & model → generate → download / save to library.
 */

import { useState } from "react";
import { Download, ImagePlus, Loader2, Sparkles, Save, RefreshCw, TriangleAlert } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { downloadBlob, downloadUrl } from "@/lib/download";
import { saveToLibrary } from "@/lib/library-save";
import { cn } from "@/lib/utils";

type StyleKey = "none" | "photoreal" | "anime" | "digital" | "render3d" | "cyberpunk" | "watercolor";
type SizeKey = "square" | "portrait" | "landscape";
type ModelKey = "flux" | "turbo";

const STYLES: { key: StyleKey; label: string; suffix: string }[] = [
  { key: "none", label: "✨ As-is", suffix: "" },
  { key: "photoreal", label: "📷 Photorealistic", suffix: ", photorealistic, ultra-detailed, sharp focus, professional photography, 8k" },
  { key: "anime", label: "🎌 Anime", suffix: ", anime style, vibrant colors, detailed illustration, studio-quality" },
  { key: "digital", label: "🎨 Digital Art", suffix: ", digital art, concept art, highly detailed, trending on artstation" },
  { key: "render3d", label: "🧊 3D Render", suffix: ", 3d render, octane render, cinematic lighting, high detail" },
  { key: "cyberpunk", label: "🌃 Cyberpunk", suffix: ", cyberpunk style, neon lights, futuristic city, dramatic lighting" },
  { key: "watercolor", label: "🖌️ Watercolor", suffix: ", watercolor painting, soft brushstrokes, artistic, elegant" },
];

const SIZES: { key: SizeKey; label: string; width: number; height: number }[] = [
  { key: "square", label: "⬛ Square 1:1", width: 1024, height: 1024 },
  { key: "portrait", label: "📱 Portrait 9:16", width: 1024, height: 1792 },
  { key: "landscape", label: "🖥️ Landscape 16:9", width: 1792, height: 1024 },
];

const MODELS: { key: ModelKey; label: string; hint: string }[] = [
  { key: "flux", label: "⚡ Flux", hint: "Best quality" },
  { key: "turbo", label: "🚀 Turbo", hint: "Faster" },
];

function buildUrl(prompt: string, style: StyleKey, size: SizeKey, model: ModelKey, seed: number): string {
  const styleSuffix = STYLES.find((s) => s.key === style)?.suffix ?? "";
  const dims = SIZES.find((s) => s.key === size) ?? SIZES[0];
  const full = `${prompt}${styleSuffix}`.slice(0, 500);
  return (
    `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}` +
    `?width=${dims.width}&height=${dims.height}&nologo=true&model=${model}&seed=${seed}`
  );
}

export default function ImageGenerator() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<StyleKey>("photoreal");
  const [size, setSize] = useState<SizeKey>("square");
  const [model, setModel] = useState<ModelKey>("flux");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);

  const generate = (newSeed?: number) => {
    if (!prompt.trim()) {
      toast({ title: "Pehle prompt likho! ✍️", variant: "error" });
      return;
    }
    const s = newSeed ?? Math.floor(Math.random() * 999999);
    setSeed(s);
    setError(null);
    setLoading(true);
    setImageUrl(buildUrl(prompt.trim(), style, size, model, s));
  };

  const handleImgError = () => {
    setLoading(false);
    setError("Image generate nahi ho saki. Internet check karo aur dobara try karo.");
  };

  const fetchBlob = async (): Promise<Blob | null> => {
    if (!imageUrl) return null;
    try {
      const res = await fetch(imageUrl, { mode: "cors" });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  };

  const download = async () => {
    if (!imageUrl) return;
    const blob = await fetchBlob();
    const name = `ai-image-${Date.now()}.jpg`;
    if (blob) {
      downloadBlob(blob, name);
      toast({ title: "Download ho gaya! 📥", variant: "success" });
    } else {
      // Cross-origin fallback — opens in new tab
      downloadUrl(imageUrl, name);
    }
  };

  const save = async () => {
    if (!imageUrl || saving) return;
    setSaving(true);
    try {
      const blob = await fetchBlob();
      if (!blob) {
        toast({ title: "Save failed — image load nahi hui", variant: "error" });
        return;
      }
      await saveToLibrary("image", blob, `ai-image-${Date.now()}.jpg`, {
        tool: "image-generator",
        prompt: prompt.trim().slice(0, 200),
      });
      toast({ title: "Library mein save ho gaya! 💾", variant: "success" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-5">
      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
          Describe your image ✨
        </label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A majestic lion standing on a cliff at sunset, dramatic clouds..."
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Style presets */}
      <div>
        <p className="text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Style</p>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStyle(s.key)}
              className={cn(
                "px-3 py-2 rounded-xl text-sm font-medium border transition",
                style === s.key
                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Size + Model */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Size</p>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button
                key={s.key}
                onClick={() => setSize(s.key)}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm font-medium border transition",
                  size === s.key
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">Model</p>
          <div className="flex flex-wrap gap-2">
            {MODELS.map((m) => (
              <button
                key={m.key}
                onClick={() => setModel(m.key)}
                title={m.hint}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm font-medium border transition",
                  model === m.key
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate */}
      <Button onClick={() => generate()} disabled={loading || !prompt.trim()} size="lg" className="w-full">
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Sparkles size={18} /> Generate Image ✨
          </>
        )}
      </Button>

      {/* Result */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <TriangleAlert size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {imageUrl && !error && (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 min-h-[200px] flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 z-10">
                <Loader2 size={32} className="animate-spin text-amber-500" />
                <p className="text-sm text-zinc-400">AI image bana raha hai…</p>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={prompt}
              onLoad={() => setLoading(false)}
              onError={handleImgError}
              className="w-full h-auto max-h-[600px] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={download} variant="secondary">
              <Download size={16} /> Download
            </Button>
            <Button onClick={save} disabled={saving} variant="secondary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving…" : "Save to Library"}
            </Button>
            <Button onClick={() => generate()} variant="ghost" disabled={loading}>
              <RefreshCw size={16} /> Regenerate
            </Button>
          </div>
        </div>
      )}

      {!imageUrl && !error && (
        <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl">
          <ImagePlus size={40} className="text-zinc-400 mb-3" />
          <p className="text-sm text-zinc-500 max-w-xs">
            Prompt likho, style select karo aur <b>Generate</b> dabao — AI image free mein ban jayegi! 🎨
          </p>
        </div>
      )}
    </Card>
  );
}
