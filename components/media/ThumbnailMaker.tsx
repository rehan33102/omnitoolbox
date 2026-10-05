"use client";

/**
 * YouTube Thumbnail Maker — 1280×720 canvas.
 * Upload your photo → auto background removal → pick a style preset,
 * add big title + subtitle + emoji stickers → download PNG/JPG.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, Sparkles, Type, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { loadBgEngine, removeBackgroundSmart, type RemoveFn } from "@/lib/bg-engine";
import { saveBlob } from "@/lib/db";
import { saveToLibrary } from "@/lib/library-save";
import { downloadUrl } from "@/lib/download";

const W = 1280, H = 720;

type StylePreset = "viral" | "professional" | "bold" | "minimal";

const PRESETS: Record<StylePreset, { label: string; bg: string; titleColor: string; subColor: string; stroke: boolean }> = {
  viral: { label: "🔥 Viral", bg: "#dc2626", titleColor: "#ffffff", subColor: "#fef08a", stroke: true },
  professional: { label: "💼 Professional", bg: "grad-dark", titleColor: "#ffffff", subColor: "#a5b4fc", stroke: false },
  bold: { label: "⚡ Bold", bg: "#facc15", titleColor: "#000000", subColor: "#1c1917", stroke: false },
  minimal: { label: "✨ Minimal", bg: "#ffffff", titleColor: "#000000", subColor: "#57534e", stroke: false },
};

const SOLID_COLORS = [
  "#dc2626", "#f97316", "#facc15", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#000000", "#ffffff",
];

const GRADIENTS: { name: string; css: [string, string] }[] = [
  { name: "Sunset", css: ["#f97316", "#dc2626"] },
  { name: "Ocean", css: ["#0ea5e9", "#1e3a8a"] },
  { name: "Purple", css: ["#8b5cf6", "#ec4899"] },
  { name: "Forest", css: ["#166534", "#052e16"] },
  { name: "Night", css: ["#1e293b", "#020617"] },
];

const SCENE_PHOTOS = [
  { name: "Beach", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&q=80" },
  { name: "City Night", img: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1280&q=80" },
  { name: "Mountains", img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&q=80" },
  { name: "Neon", img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1280&q=80" },
  { name: "Office", img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80" },
  { name: "Galaxy", img: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1280&q=80" },
];

const EMOJIS = ["🔥", "😱", "💰", "⚡", "🚀", "💯", "👀", "🎯", "💥", "⭐", "🏆", "❤️", "😮", "🤯", "👍", "🎬"];

type BgMode = "solid" | "gradient" | "photo" | "transparent";

function Slider({ label, value, min, max, onChange, fmt }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)} className="flex-1 accent-fuchsia-500" />
      <span className="w-12 shrink-0 text-right text-zinc-300">{fmt(value)}</span>
    </label>
  );
}

/** Wrap text into lines that fit maxWidth. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export default function ThumbnailMaker() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const removeFn = useRef<RemoveFn | null>(null);

  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null); // cutout RGBA
  const [removing, setRemoving] = useState(false);

  const [title, setTitle] = useState("MY AMAZING VIDEO");
  const [subtitle, setSubtitle] = useState("you won't believe this!");
  const [preset, setPreset] = useState<StylePreset>("viral");

  const [bgMode, setBgMode] = useState<BgMode>("solid");
  const [bgColor, setBgColor] = useState("#dc2626");
  const [bgGrad, setBgGrad] = useState(0);
  const [bgPhoto, setBgPhoto] = useState(0);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);

  const [fontSize, setFontSize] = useState(120);
  const [subSize, setSubSize] = useState(56);
  const [titleColor, setTitleColor] = useState("#ffffff");
  const [subColor, setSubColor] = useState("#fef08a");
  const [stroke, setStroke] = useState(true);
  const [position, setPosition] = useState<"top" | "center" | "bottom">("center");
  const [stickers, setStickers] = useState<string[]>([]);
  const [faceSize, setFaceSize] = useState(62); // % of canvas height
  const [faceX, setFaceX] = useState(78); // % from left

  const onProgress = useCallback(() => {}, []);

  const handleUpload = async (f: File) => {
    setRemoving(true);
    try {
      const ensure = async () => {
        if (!removeFn.current) removeFn.current = await loadBgEngine(onProgress);
        return removeFn.current;
      };
      const blob = await removeBackgroundSmart(f, onProgress, ensure);
      const bmp = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bmp.width; c.height = bmp.height;
      c.getContext("2d")!.drawImage(bmp, 0, 0);
      bmp.close();
      setPhoto(c);
      toast({ title: "Photo ready — background removed!", variant: "success" });
    } catch (e) {
      toast({ title: "Background removal failed", variant: "error" });
    } finally {
      setRemoving(false);
    }
  };

  // Load selected background photo
  useEffect(() => {
    if (bgMode !== "photo") return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBgImg(img);
    img.src = SCENE_PHOTOS[bgPhoto].img;
  }, [bgMode, bgPhoto]);

  const applyPreset = (p: StylePreset) => {
    setPreset(p);
    const pr = PRESETS[p];
    setTitleColor(pr.titleColor);
    setSubColor(pr.subColor);
    setStroke(pr.stroke);
    if (pr.bg === "grad-dark") { setBgMode("gradient"); setBgGrad(4); }
    else { setBgMode("solid"); setBgColor(pr.bg); }
  };

  /** Main render. */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    // Background
    if (bgMode === "solid") {
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H);
    } else if (bgMode === "gradient") {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, GRADIENTS[bgGrad].css[0]);
      g.addColorStop(1, GRADIENTS[bgGrad].css[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (bgMode === "photo" && bgImg) {
      const ir = bgImg.naturalWidth / bgImg.naturalHeight, cr = W / H;
      let dw = W, dh = H;
      if (ir > cr) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
      ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    // transparent → checkerboard-ish dark so text still visible
    if (bgMode === "transparent") {
      ctx.fillStyle = "#18181b"; ctx.fillRect(0, 0, W, H);
    }

    // Subject photo (cutout), right side
    if (photo) {
      const fh = H * (faceSize / 100);
      const fw = fh * (photo.width / photo.height);
      const fx = W * (faceX / 100) - fw / 2;
      const fy = H - fh - 24;
      ctx.drawImage(photo, fx, fy, fw, fh);
    }

    // Text block
    const textW = photo ? W * 0.52 : W * 0.86;
    const tx = 64;
    ctx.textBaseline = "middle";

    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    const lines = wrapLines(ctx, title.toUpperCase(), textW);
    const lineH = fontSize * 1.08;
    const blockH = lines.length * lineH + (subtitle ? subSize * 1.4 : 0);
    let startY = position === "top" ? 120 + lineH / 2
      : position === "bottom" ? H - 120 - blockH + lineH / 2
      : H / 2 - blockH / 2 + lineH / 2;

    lines.forEach((ln, i) => {
      const y = startY + i * lineH;
      if (stroke) {
        ctx.lineWidth = Math.max(6, fontSize / 14);
        ctx.strokeStyle = "#000000";
        ctx.strokeText(ln, tx, y);
      }
      ctx.fillStyle = titleColor;
      ctx.fillText(ln, tx, y);
    });

    if (subtitle) {
      ctx.font = `700 ${subSize}px Arial, sans-serif`;
      const sy = startY + lines.length * lineH + subSize * 0.4;
      if (stroke) {
        ctx.lineWidth = Math.max(3, subSize / 16);
        ctx.strokeStyle = "#000000";
        ctx.strokeText(subtitle, tx, sy);
      }
      ctx.fillStyle = subColor;
      ctx.fillText(subtitle, tx, sy);
    }

    // Stickers (emojis) along the top-right
    ctx.font = "110px serif";
    stickers.forEach((s, i) => {
      ctx.fillText(s, W - 150 - i * 130, 90);
    });
  }, [photo, title, subtitle, bgMode, bgColor, bgGrad, bgPhoto, bgImg,
      fontSize, subSize, titleColor, subColor, stroke, position,
      stickers, faceSize, faceX]);

  const download = (fmt: "png" | "jpg") => {
    const cv = canvasRef.current;
    if (!cv) return;
    downloadUrl(cv.toDataURL(fmt === "png" ? "image/png" : "image/jpeg", 0.92), `thumbnail.${fmt}`);
    toast({ title: `Downloaded ${fmt.toUpperCase()}!`, variant: "success" });
  };

  const handleSaveToLibrary = async () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob(async (blob) => {
      if (!blob) return;
      await saveToLibrary("image", blob, `thumbnail-${Date.now()}.png`, { tool: "thumbnail-maker" });
      toast({ title: "Saved to Library!", variant: "success" });
    }, "image/png");
  };

  const addSticker = (e: string) => {
    if (stickers.length >= 4) { toast({ title: "Max 4 stickers", variant: "error" }); return; }
    setStickers([...stickers, e]);
  };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="overflow-hidden rounded-xl ring-1 ring-white/10 bg-black">
          <canvas ref={canvasRef} width={W} height={H} className="block w-full" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => download("png")}><Download size={14} /> PNG</Button>
          <Button size="sm" variant="secondary" onClick={() => download("jpg")}><Download size={14} /> JPG</Button>
          <Button size="sm" variant="outline" onClick={handleSaveToLibrary}><ImagePlus size={14} /> Save to Library</Button>
        </div>
      </Card>

      {/* Photo upload */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><ImagePlus size={16} /> Your Photo</h3>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 px-4 py-6 text-sm text-zinc-400 hover:border-fuchsia-500/50 hover:text-zinc-200 transition">
          {removing ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          {removing ? "Removing background…" : photo ? "Change photo" : "Upload your face photo"}
          <input type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
        </label>
        {photo && (
          <div className="space-y-2.5">
            <Slider label="Face size" value={faceSize} min={30} max={100} onChange={setFaceSize} fmt={v => `${v}%`} />
            <Slider label="Face position" value={faceX} min={20} max={95} onChange={setFaceX} fmt={v => `${v}%`} />
            <Button size="sm" variant="ghost" onClick={() => setPhoto(null)}><Trash2 size={14} /> Remove photo</Button>
          </div>
        )}
      </Card>

      {/* Style presets */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles size={16} /> Style Presets</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(PRESETS) as StylePreset[]).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ring-2 ${preset === p ? "ring-fuchsia-400 scale-[1.03]" : "ring-white/10 hover:ring-white/25"}`}
              style={{ background: PRESETS[p].bg === "grad-dark" ? "linear-gradient(135deg,#1e293b,#020617)" : PRESETS[p].bg, color: PRESETS[p].titleColor }}>
              {PRESETS[p].label}
            </button>
          ))}
        </div>
      </Card>

      {/* Text */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Type size={16} /> Text</h3>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="MAIN TITLE" maxLength={40} />
        <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="subtitle…" maxLength={60} />
        <div className="space-y-2.5 pt-1">
          <Slider label="Title size" value={fontSize} min={48} max={180} onChange={setFontSize} fmt={v => `${v}px`} />
          <Slider label="Subtitle size" value={subSize} min={28} max={100} onChange={setSubSize} fmt={v => `${v}px`} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Title color
            <input type="color" value={titleColor} onChange={e => setTitleColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded bg-transparent" />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Sub color
            <input type="color" value={subColor} onChange={e => setSubColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded bg-transparent" />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <Switch checked={stroke} onChange={setStroke} /> Black stroke
          </label>
        </div>
        <div className="flex gap-2">
          {(["top", "center", "bottom"] as const).map(p => (
            <Button key={p} size="sm" variant={position === p ? "primary" : "secondary"}
              onClick={() => setPosition(p)} className="capitalize">{p}</Button>
          ))}
        </div>
      </Card>

      {/* Background */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">🖼️ Background</h3>
        <div className="flex gap-2">
          {(["solid", "gradient", "photo", "transparent"] as BgMode[]).map(m => (
            <Button key={m} size="sm" variant={bgMode === m ? "primary" : "secondary"}
              onClick={() => setBgMode(m)} className="capitalize">{m}</Button>
          ))}
        </div>
        {bgMode === "solid" && (
          <div className="flex flex-wrap gap-1.5">
            {SOLID_COLORS.map(c => (
              <button key={c} onClick={() => setBgColor(c)} aria-label={c}
                className={`h-9 w-9 rounded-full ring-2 transition ${bgColor === c ? "ring-fuchsia-400 scale-110" : "ring-white/20"}`}
                style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded bg-transparent" />
          </div>
        )}
        {bgMode === "gradient" && (
          <div className="grid grid-cols-5 gap-1.5">
            {GRADIENTS.map((g, i) => (
              <button key={g.name} onClick={() => setBgGrad(i)} title={g.name}
                className={`h-12 rounded-lg ring-2 transition ${bgGrad === i ? "ring-fuchsia-400 scale-[1.03]" : "ring-white/10"}`}
                style={{ background: `linear-gradient(135deg, ${g.css[0]}, ${g.css[1]})` }} />
            ))}
          </div>
        )}
        {bgMode === "photo" && (
          <div className="grid grid-cols-3 gap-1.5">
            {SCENE_PHOTOS.map((s, i) => (
              <button key={s.name} onClick={() => setBgPhoto(i)}
                className={`relative h-16 overflow-hidden rounded-lg ring-2 transition ${bgPhoto === i ? "ring-fuchsia-400 scale-[1.03]" : "ring-white/10"}`}>
                <img src={s.img} alt={s.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-[10px] text-white">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Stickers */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">😎 Stickers</h3>
          {stickers.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setStickers([])}>Clear</Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map(e => (
            <button key={e} onClick={() => addSticker(e)}
              className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-2xl ring-1 ring-white/10 transition hover:scale-110 hover:bg-white/10">
              {e}
            </button>
          ))}
        </div>
        {stickers.length > 0 && (
          <p className="text-xs text-zinc-500">Active: {stickers.join(" ")}</p>
        )}
      </Card>
    </div>
  );
}
