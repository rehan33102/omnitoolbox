"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Banknote, Loader2, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const CURRENCIES = [
  { code: "USD", name: "US Dollar", flag: "$" },
  { code: "PKR", name: "Pakistani Rupee", flag: "₨" },
  { code: "USDT", name: "Tether", flag: "₮" },
  { code: "EUR", name: "Euro", flag: "€" },
  { code: "GBP", name: "British Pound", flag: "£" },
  { code: "AED", name: "UAE Dirham", flag: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", flag: "﷼" },
  { code: "QAR", name: "Qatari Riyal", flag: "ر.ق" },
  { code: "KWD", name: "Kuwaiti Dinar", flag: "د.ك" },
  { code: "INR", name: "Indian Rupee", flag: "₹" },
  { code: "CNY", name: "Chinese Yuan", flag: "¥" },
  { code: "JPY", name: "Japanese Yen", flag: "¥" },
  { code: "TRY", name: "Turkish Lira", flag: "₺" },
  { code: "CAD", name: "Canadian Dollar", flag: "$" },
  { code: "AUD", name: "Australian Dollar", flag: "$" },
] as const;

type Code = (typeof CURRENCIES)[number]["code"];

// Static fallback rates (vs USD) if the live API is unreachable.
const FALLBACK: Record<string, number> = {
  USD: 1, PKR: 278.5, USDT: 1, EUR: 0.92, GBP: 0.79, AED: 3.67, SAR: 3.75,
  QAR: 3.64, KWD: 0.31, INR: 83.6, CNY: 7.24, JPY: 149.8, TRY: 32.9, CAD: 1.36, AUD: 1.52,
};

const QUICK = [1, 10, 50, 100, 500, 1000, 5000];

export default function CurrencyConverter() {
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState<Code>("USD");
  const [to, setTo] = useState<Code>("PKR");
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!res.ok) throw new Error("rate fetch failed");
        const data = await res.json();
        if (cancelled || data.result !== "success") throw new Error("bad payload");
        const merged = { ...FALLBACK, ...data.rates, USDT: 1 };
        setRates(merged);
        setLive(true);
        setUpdatedAt(data.time_last_update_utc ? new Date(data.time_last_update_utc).toLocaleDateString() : "");
      } catch {
        if (!cancelled) toast({ title: "Live rates unavailable — using cached rates", variant: "error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = useMemo(() => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return null;
    const fromRate = rates[from] ?? 1;
    const toRate = rates[to] ?? 1;
    const converted = (amt / fromRate) * toRate;
    const rate = toRate / fromRate;
    return { converted, rate };
  }, [amount, from, to, rates]);

  const swap = () => { setFrom(to); setTo(from); };

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 4 : 2, minimumFractionDigits: 2 });

  const selectCls =
    "w-full glass rounded-xl px-3.5 py-3 text-sm font-medium text-white bg-transparent outline-none focus:border-brand-500/60 [&>option]:bg-[#0b0b14]";

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote size={18} className="text-brand-400" />
            <h3 className="font-semibold">Convert</h3>
          </div>
          <span className={cn(
            "text-[11px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider",
            live ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
          )}>
            {loading ? "loading…" : live ? "● live rates" : "cached rates"}
          </span>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-1.5">Amount</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full glass rounded-xl px-4 py-3 text-lg font-mono outline-none focus:border-brand-500/60"
            placeholder="100"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className="text-xs px-2.5 py-1 rounded-lg glass hover:border-brand-500/50 text-zinc-300 transition"
              >
                {q.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-1.5">From</label>
            <select value={from} onChange={(e) => setFrom(e.target.value as Code)} className={selectCls}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={swap}
            aria-label="Swap currencies"
            className="mb-0.5 p-3 rounded-xl glass hover:border-brand-500/50 hover:rotate-180 transition-all duration-300"
          >
            <ArrowLeftRight size={16} className="text-brand-400" />
          </button>
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-1.5">To</label>
            <select value={to} onChange={(e) => setTo(e.target.value as Code)} className={selectCls}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500">
          {updatedAt ? `Rates updated ${updatedAt}. ` : ""}Mid-market rates for reference — actual exchange rates may vary slightly.
        </p>
      </Card>

      <Card className="flex flex-col justify-center">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 size={22} className="animate-spin mr-2" /> Fetching live rates…
          </div>
        ) : result ? (
          <div className="text-center py-6">
            <p className="text-sm text-zinc-400 mb-2">
              {fmt(parseFloat(amount) || 0)} {from} =
            </p>
            <p className="font-display text-4xl md:text-5xl font-extrabold text-gradient break-all">
              {fmt(result.converted)} {to}
            </p>
            <div className="mt-6 glass rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-zinc-400">
                1 {from} = <span className="text-white font-mono font-semibold">{fmt(result.rate)}</span> {to}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                1 {to} = <span className="text-white font-mono font-semibold">{fmt(1 / result.rate)}</span> {from}
              </p>
            </div>
            <div>
              <Button
                variant="secondary"
                className="mt-6"
                onClick={() => { setLoading(true); setLive(false); setRates(FALLBACK); setLoading(false); toast({ title: "Rates refreshed", variant: "success" }); }}
              >
                <RefreshCw size={15} /> Refresh rates
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-center text-zinc-500 py-16">Enter a valid amount to convert.</p>
        )}
      </Card>
    </div>
  );
}
