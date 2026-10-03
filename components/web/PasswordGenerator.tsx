"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Dices, KeyRound, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";
import { saveRecord } from "@/lib/db";

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{};:,.<>?",
} as const;

const AMBIGUOUS = "0O1lI";
const BULK_COUNT = 5;

type SetKey = keyof typeof SETS;

const SET_META: { key: SetKey; label: string; sample: string }[] = [
  { key: "lower", label: "Lowercase", sample: "abc" },
  { key: "upper", label: "Uppercase", sample: "ABC" },
  { key: "digits", label: "Numbers", sample: "123" },
  { key: "symbols", label: "Symbols", sample: "#$&" },
];

/** Cryptographically secure password — never Math.random. */
function securePassword(length: number, pool: string): string {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) out += pool[buf[i] % pool.length];
  return out;
}

function Toggle({ label, sample, checked, onChange }: { label: string; sample: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 border text-left transition w-full",
        checked ? "bg-brand-600/15 border-brand-500/50" : "glass border-transparent hover:border-black/15 dark:border-white/15"
      )}
    >
      <span>
        <span className={cn("block text-sm font-medium", checked ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300")}>{label}</span>
        <span className="block text-xs font-mono text-zinc-500">{sample}</span>
      </span>
      <span
        className={cn(
          "relative w-10 h-6 rounded-full transition shrink-0",
          checked ? "bg-brand-500" : "bg-black/5 dark:bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

function strengthOf(bits: number): { label: string; color: string; bar: string } {
  if (bits < 50) return { label: "Weak", color: "text-red-400", bar: "bg-red-500" };
  if (bits < 80) return { label: "Fair", color: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500" };
  if (bits < 110) return { label: "Strong", color: "text-emerald-400", bar: "bg-emerald-500" };
  return { label: "Elite", color: "text-fuchsia-400", bar: "bg-fuchsia-500" };
}

export default function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [enabled, setEnabled] = useState<Record<SetKey, boolean>>({ lower: true, upper: true, digits: true, symbols: true });
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [password, setPassword] = useState("");
  const [bulk, setBulk] = useState<string[]>([]);
  const { toast } = useToast();
  const { copy } = useCopyToClipboard();
  const [copiedBulk, setCopiedBulk] = useState<number | null>(null);

  const pool = useMemo(() => {
    let chars = (Object.keys(SETS) as SetKey[]).filter((k) => enabled[k]).map((k) => SETS[k]).join("");
    if (excludeAmbiguous) chars = chars.split("").filter((c) => !AMBIGUOUS.includes(c)).join("");
    return chars;
  }, [enabled, excludeAmbiguous]);

  const bits = useMemo(() => (pool.length > 0 ? length * Math.log2(pool.length) : 0), [length, pool]);
  const strength = strengthOf(bits);

  const regenerate = useCallback(() => {
    if (!pool) return;
    const pw = securePassword(length, pool);
    setPassword(pw);
    setBulk(Array.from({ length: BULK_COUNT }, () => securePassword(length, pool)));
    setCopiedBulk(null);
    return pw;
  }, [length, pool]);

  // Save a record of each explicitly generated password (not auto-regenerates from slider drags).
  const generateAndSave = () => {
    const pw = regenerate();
    if (!pw) return;
    try {
      void saveRecord("password", {
        password: pw,
        length,
        options: { ...enabled, excludeAmbiguous },
        createdAt: Date.now(),
      });
    } catch {
      /* library save is non-critical */
    }
  };

  // Auto-generate whenever options change
  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const toggleSet = (key: SetKey) => {
    const activeCount = (Object.keys(enabled) as SetKey[]).filter((k) => enabled[k]).length;
    if (enabled[key] && activeCount === 1) {
      toast({ title: "Keep at least one character set", variant: "error" });
      return;
    }
    setEnabled((p) => ({ ...p, [key]: !p[key] }));
  };

  const copyBulk = async (pw: string, i: number) => {
    await copy(pw, "Password copied!");
    setCopiedBulk(i);
    window.setTimeout(() => setCopiedBulk(null), 1500);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Length</span>
            <span className="text-xs font-mono text-zinc-500">{length} characters</span>
          </div>
          <input
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full accent-fuchsia-500"
            aria-label="Password length"
          />
          <div className="flex justify-between text-[11px] text-zinc-600 mt-1">
            <span>8</span>
            <span>64</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SET_META.map((s) => (
            <Toggle key={s.key} label={s.label} sample={s.sample} checked={enabled[s.key]} onChange={() => toggleSet(s.key)} />
          ))}
        </div>

        <Toggle
          label="Exclude ambiguous characters"
          sample="0 O 1 l I"
          checked={excludeAmbiguous}
          onChange={setExcludeAmbiguous}
        />

        <Button onClick={generateAndSave} className="w-full" disabled={!pool}>
          <RefreshCw size={16} /> Generate new password
        </Button>
      </Card>

      <div className="space-y-5">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={18} className="text-brand-700 dark:text-brand-400" />
            <h3 className="font-semibold">Your password</h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 glass rounded-xl px-4 py-3.5 overflow-x-auto">
              <p className="font-mono text-lg whitespace-nowrap select-all">{password || "—"}</p>
            </div>
            <Button
              size="icon"
              variant="secondary"
              onClick={() => password && copy(password, "Password copied!")}
              aria-label="Copy password"
              disabled={!password}
            >
              <Copy size={16} />
            </Button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={cn("font-semibold uppercase tracking-widest", strength.color)}>{strength.label}</span>
              <span className="text-zinc-500 font-mono">{Math.round(bits)} bits of entropy</span>
            </div>
            <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", strength.bar)}
                style={{ width: `${Math.min(100, Math.round((bits / 128) * 100))}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
              Generated with your device&apos;s cryptographic RNG — it never leaves this page.
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Dices size={18} className="text-accent-600 dark:text-accent-400" />
              <h3 className="font-semibold">Bulk — pick your favorite</h3>
            </div>
            <button
              onClick={generateAndSave}
              className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition"
            >
              <RefreshCw size={13} /> Reroll all
            </button>
          </div>
          <div className="space-y-2">
            {bulk.map((pw, i) => (
              <div key={i} className="flex items-center gap-2 glass rounded-xl px-3.5 py-2.5">
                <p className="flex-1 font-mono text-sm truncate select-all">{pw}</p>
                <button
                  onClick={() => copyBulk(pw, i)}
                  aria-label={`Copy password ${i + 1}`}
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
                >
                  {copiedBulk === i ? <Check size={15} className="text-emerald-700 dark:text-emerald-400" /> : <Copy size={15} className="text-zinc-600 dark:text-zinc-400" />}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
