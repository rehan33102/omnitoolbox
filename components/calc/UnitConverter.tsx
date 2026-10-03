"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Ruler } from "lucide-react";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type CategoryKey = "length" | "weight" | "temperature" | "volume" | "speed" | "data";

interface UnitDef { code: string; label: string; toBase: (v: number) => number; fromBase: (v: number) => number; }

const CATEGORIES: Record<CategoryKey, { label: string; units: UnitDef[] }> = {
  length: {
    label: "Length",
    units: [
      { code: "mm", label: "Millimeters", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      { code: "cm", label: "Centimeters", toBase: (v) => v / 100, fromBase: (v) => v * 100 },
      { code: "m", label: "Meters", toBase: (v) => v, fromBase: (v) => v },
      { code: "km", label: "Kilometers", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { code: "in", label: "Inches", toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
      { code: "ft", label: "Feet", toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
      { code: "yd", label: "Yards", toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
      { code: "mi", label: "Miles", toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
    ],
  },
  weight: {
    label: "Weight",
    units: [
      { code: "mg", label: "Milligrams", toBase: (v) => v / 1e6, fromBase: (v) => v * 1e6 },
      { code: "g", label: "Grams", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      { code: "kg", label: "Kilograms", toBase: (v) => v, fromBase: (v) => v },
      { code: "t", label: "Tonnes", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { code: "oz", label: "Ounces", toBase: (v) => v * 0.0283495, fromBase: (v) => v / 0.0283495 },
      { code: "lb", label: "Pounds", toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
      { code: "st", label: "Stones", toBase: (v) => v * 6.35029, fromBase: (v) => v / 6.35029 },
    ],
  },
  temperature: {
    label: "Temperature",
    units: [
      { code: "C", label: "Celsius", toBase: (v) => v, fromBase: (v) => v },
      { code: "F", label: "Fahrenheit", toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      { code: "K", label: "Kelvin", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
  volume: {
    label: "Volume",
    units: [
      { code: "ml", label: "Milliliters", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      { code: "l", label: "Liters", toBase: (v) => v, fromBase: (v) => v },
      { code: "m3", label: "Cubic meters", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { code: "tsp", label: "Teaspoons (US)", toBase: (v) => v * 0.00492892, fromBase: (v) => v / 0.00492892 },
      { code: "tbsp", label: "Tablespoons (US)", toBase: (v) => v * 0.0147868, fromBase: (v) => v / 0.0147868 },
      { code: "floz", label: "Fluid ounces (US)", toBase: (v) => v * 0.0295735, fromBase: (v) => v / 0.0295735 },
      { code: "cup", label: "Cups (US)", toBase: (v) => v * 0.236588, fromBase: (v) => v / 0.236588 },
      { code: "pt", label: "Pints (US)", toBase: (v) => v * 0.473176, fromBase: (v) => v / 0.473176 },
      { code: "gal", label: "Gallons (US)", toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
    ],
  },
  speed: {
    label: "Speed",
    units: [
      { code: "ms", label: "m/s", toBase: (v) => v, fromBase: (v) => v },
      { code: "kmh", label: "km/h", toBase: (v) => v / 3.6, fromBase: (v) => v * 3.6 },
      { code: "mph", label: "mph", toBase: (v) => v * 0.44704, fromBase: (v) => v / 0.44704 },
      { code: "kn", label: "Knots", toBase: (v) => v * 0.514444, fromBase: (v) => v / 0.514444 },
      { code: "fts", label: "ft/s", toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    ],
  },
  data: {
    label: "Digital storage",
    units: [
      { code: "b", label: "Bits", toBase: (v) => v / 8, fromBase: (v) => v * 8 },
      { code: "B", label: "Bytes", toBase: (v) => v, fromBase: (v) => v },
      { code: "KB", label: "Kilobytes", toBase: (v) => v * 1024, fromBase: (v) => v / 1024 },
      { code: "MB", label: "Megabytes", toBase: (v) => v * 1024 ** 2, fromBase: (v) => v / 1024 ** 2 },
      { code: "GB", label: "Gigabytes", toBase: (v) => v * 1024 ** 3, fromBase: (v) => v / 1024 ** 3 },
      { code: "TB", label: "Terabytes", toBase: (v) => v * 1024 ** 4, fromBase: (v) => v / 1024 ** 4 },
    ],
  },
};

const TABS: CategoryKey[] = ["length", "weight", "temperature", "volume", "speed", "data"];

const DEFAULTS: Record<CategoryKey, [string, string]> = {
  length: ["km", "mi"],
  weight: ["kg", "lb"],
  temperature: ["C", "F"],
  volume: ["l", "gal"],
  speed: ["kmh", "mph"],
  data: ["MB", "GB"],
};

export default function UnitConverter() {
  const [cat, setCat] = useState<CategoryKey>("length");
  const [value, setValue] = useState("1");
  const [from, setFrom] = useState("km");
  const [to, setTo] = useState("mi");

  const units = CATEGORIES[cat].units;

  const switchCat = (c: CategoryKey) => {
    setCat(c);
    setFrom(DEFAULTS[c][0]);
    setTo(DEFAULTS[c][1]);
  };

  const result = useMemo(() => {
    const v = parseFloat(value);
    if (isNaN(v)) return null;
    const f = units.find((u) => u.code === from);
    const t = units.find((u) => u.code === to);
    if (!f || !t) return null;
    return t.fromBase(f.toBase(v));
  }, [value, from, to, units]);

  const allResults = useMemo(() => {
    const v = parseFloat(value);
    if (isNaN(v)) return [];
    const f = units.find((u) => u.code === from);
    if (!f) return [];
    const base = f.toBase(v);
    return units.filter((u) => u.code !== from).map((u) => ({ unit: u, val: u.fromBase(base) }));
  }, [value, from, units]);

  const fmt = (n: number) =>
    Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)
      ? n.toExponential(4)
      : n.toLocaleString("en-US", { maximumFractionDigits: 6 });

  const selectCls =
    "w-full glass rounded-xl px-3.5 py-3 text-sm font-medium outline-none focus:border-brand-500/60 [&>option]:bg-white dark:[&>option]:bg-white dark:[&>option]:bg-[#0b0b14]";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => switchCat(t)}
            className={cn(
              "px-4 py-2 text-sm rounded-xl border transition",
              cat === t
                ? "bg-brand-600 text-white border-brand-500 shadow-glow"
                : "glass border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-black/15 dark:border-white/15"
            )}
          >
            {CATEGORIES[t].label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="space-y-5">
          <div className="flex items-center gap-2">
            <Ruler size={18} className="text-brand-700 dark:text-brand-400" />
            <h3 className="font-semibold">{CATEGORIES[cat].label} converter</h3>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full glass rounded-xl px-4 py-3 text-lg font-mono outline-none focus:border-brand-500/60"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">From</label>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls}>
                {units.map((u) => (
                  <option key={u.code} value={u.code}>{u.label} ({u.code})</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { setFrom(to); setTo(from); }}
              aria-label="Swap units"
              className="mb-0.5 p-3 rounded-xl glass hover:border-brand-500/50 hover:rotate-180 transition-all duration-300"
            >
              <ArrowLeftRight size={16} className="text-brand-700 dark:text-brand-400" />
            </button>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">To</label>
              <select value={to} onChange={(e) => setTo(e.target.value)} className={selectCls}>
                {units.map((u) => (
                  <option key={u.code} value={u.code}>{u.label} ({u.code})</option>
                ))}
              </select>
            </div>
          </div>
          {result !== null && (
            <div className="glass rounded-xl px-4 py-4 text-center">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">{value || "0"} {from} =</p>
              <p className="font-display text-3xl font-extrabold text-gradient">{fmt(result)} <span className="text-lg">{to}</span></p>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">All {CATEGORIES[cat].label.toLowerCase()} equivalents</h3>
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {allResults.map(({ unit, val }) => (
              <div key={unit.code} className="flex items-center justify-between glass rounded-lg px-3.5 py-2.5">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{unit.label}</span>
                <span className="font-mono text-sm text-zinc-900 dark:text-white">{fmt(val)} <span className="text-zinc-500">{unit.code}</span></span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
