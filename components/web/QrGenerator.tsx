"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, FileImage, QrCode } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveBlob } from "@/lib/db";

type ECLevel = "L" | "M" | "Q" | "H";

const EC_OPTIONS: { value: ECLevel; label: string }[] = [
  { value: "L", label: "Low · 7%" },
  { value: "M", label: "Medium · 15%" },
  { value: "Q", label: "Quartile · 25%" },
  { value: "H", label: "High · 30%" },
];

export default function QrGenerator() {
  const [text, setText] = useState("");
  const [size, setSize] = useState(512);
  const [fg, setFg] = useState("#111111");
  const [bg, setBg] = useState("#ffffff");
  const [ec, setEc] = useState<ECLevel>("M");
  const [dataUrl, setDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const { toast } = useToast();
  const timer = useRef<number | null>(null);
  const savedForRef = useRef("");

  const generate = useCallback(async () => {
    const value = text.trim();
    if (!value) {
      setDataUrl("");
      return;
    }
    setBusy(true);
    try {
      const url = await QRCode.toDataURL(value, {
        errorCorrectionLevel: ec,
        width: size,
        margin: 2,
        color: { dark: fg, light: bg },
      });
      setDataUrl(url);
      // Auto-save to My Library (once per distinct text) — best-effort.
      if (savedForRef.current !== value) {
        savedForRef.current = value;
        try {
          const blob = await (await fetch(url)).blob();
          const id = await saveBlob("qr", blob, `qr-${Date.now()}.png`, {
            text: value.slice(0, 100),
          });
          if (id) setSavedNote(true);
        } catch {
          /* library save is non-critical */
        }
      }
    } catch {
      toast({
        title: "Could not generate QR code",
        variant: "error",
        description: "The text may be too long for this error-correction level.",
      });
    } finally {
      setBusy(false);
    }
  }, [text, size, fg, bg, ec, toast]);

  // Debounced live preview
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(generate, 350);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [generate]);

  const triggerDownload = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const requireInput = () => {
    if (!text.trim()) {
      toast({ title: "Enter some text first", variant: "error", description: "Type a URL or any text above." });
      return false;
    }
    return true;
  };

  const downloadPng = () => {
    if (!requireInput() || !dataUrl) return;
    triggerDownload(dataUrl, `qr-code-${size}px.png`);
    toast({ title: "PNG download started", variant: "success" });
  };

  const downloadSvg = async () => {
    if (!requireInput()) return;
    try {
      const svg = await QRCode.toString(text.trim(), {
        type: "svg",
        errorCorrectionLevel: ec,
        margin: 2,
        color: { dark: fg, light: bg },
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, "qr-code.svg");
      toast({ title: "SVG download started", variant: "success" });
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast({ title: "SVG export failed", variant: "error" });
    }
  };

  const copyImage = async () => {
    if (!requireInput() || !dataUrl) return;
    try {
      if (typeof ClipboardItem === "undefined") throw new Error("unsupported");
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({ title: "QR image copied", variant: "success" });
    } catch {
      toast({ title: "Copy not supported here", variant: "error", description: "Use the Download buttons instead." });
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="space-y-5">
        <Textarea
          label="Text or URL"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://your-link.com — encodes as you type"
          hint="Anything you type becomes a scannable QR code, instantly."
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Size</span>
            <span className="text-xs text-zinc-500">{size} × {size} px</span>
          </div>
          <input
            type="range"
            min={128}
            max={1024}
            step={64}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-fuchsia-500"
            aria-label="QR code size"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Foreground</span>
            <label className="flex items-center gap-2 glass rounded-xl p-2 cursor-pointer">
              <input
                type="color"
                value={fg}
                onChange={(e) => setFg(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                aria-label="QR foreground color"
              />
              <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 uppercase">{fg}</span>
            </label>
          </div>
          <div>
            <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Background</span>
            <label className="flex items-center gap-2 glass rounded-xl p-2 cursor-pointer">
              <input
                type="color"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                aria-label="QR background color"
              />
              <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 uppercase">{bg}</span>
            </label>
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Error correction</span>
          <div className="grid grid-cols-4 gap-2">
            {EC_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setEc(o.value)}
                className={`rounded-xl px-2 py-2.5 text-xs font-medium border transition ${
                  ec === o.value
                    ? "bg-brand-600/25 border-brand-500/60 text-zinc-900 dark:text-white"
                    : "glass text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-transparent"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">Higher correction survives damage & logos — but holds less data.</p>
        </div>
      </Card>

      <Card className="flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={18} className="text-brand-700 dark:text-brand-400" />
          <h3 className="font-semibold">Live preview</h3>
          {busy && <span className="text-xs text-zinc-500 ml-auto animate-pulse">Rendering…</span>}
          {!busy && savedNote && dataUrl && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400 ml-auto">Saved to Library ✓</span>
          )}
        </div>

        <div className="flex-1 grid place-items-center rounded-2xl bg-white/[0.03] border border-black/10 dark:border-white/10 p-6 min-h-[280px]">
          {dataUrl ? (
            <img src={dataUrl} alt="Generated QR code" className="rounded-xl max-w-full h-auto" style={{ width: Math.min(size, 320) }} />
          ) : (
            <div className="text-center text-zinc-500">
              <QrCode size={44} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-sm">Your QR code appears here</p>
              <p className="text-xs mt-1">Type a URL or text on the left to begin</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <Button size="sm" onClick={downloadPng} disabled={!dataUrl}>
            <Download size={14} /> PNG
          </Button>
          <Button size="sm" variant="secondary" onClick={downloadSvg} disabled={!dataUrl}>
            <FileImage size={14} /> SVG
          </Button>
          <Button size="sm" variant="outline" onClick={copyImage} disabled={!dataUrl}>
            <Copy size={14} /> Copy
          </Button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-3 text-center">
          Everything is generated in your browser — nothing is uploaded or tracked.
        </p>
      </Card>
    </div>
  );
}
