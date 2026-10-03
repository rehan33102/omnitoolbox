"use client";

import { useMemo, useState } from "react";
import { Activity, Flame, HeartPulse } from "lucide-react";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const ACTIVITY = [
  { key: "sedentary", label: "Sedentary", desc: "Little/no exercise", factor: 1.2 },
  { key: "light", label: "Light", desc: "1–3 days/week", factor: 1.375 },
  { key: "moderate", label: "Moderate", desc: "3–5 days/week", factor: 1.55 },
  { key: "active", label: "Active", desc: "6–7 days/week", factor: 1.725 },
  { key: "athlete", label: "Athlete", desc: "2× daily / physical job", factor: 1.9 },
] as const;

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: "Underweight", color: "text-sky-400", bar: "bg-sky-500", width: 12 };
  if (bmi < 25) return { label: "Healthy", color: "text-emerald-400", bar: "bg-emerald-500", width: 38 };
  if (bmi < 30) return { label: "Overweight", color: "text-amber-400", bar: "bg-amber-500", width: 62 };
  return { label: "Obese", color: "text-red-400", bar: "bg-red-500", width: 88 };
}

export default function BmiCalculator() {
  const [height, setHeight] = useState("170"); // cm
  const [weight, setWeight] = useState("70"); // kg
  const [age, setAge] = useState("25");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [activity, setActivity] = useState<string>("moderate");

  const calc = useMemo(() => {
    const h = parseFloat(height), w = parseFloat(weight), a = parseFloat(age);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const bmi = w / Math.pow(h / 100, 2);
    const cat = bmiCategory(bmi);
    // Mifflin-St Jeor BMR
    const bmr = sex === "male"
      ? 10 * w + 6.25 * h - 5 * (a || 25) + 5
      : 10 * w + 6.25 * h - 5 * (a || 25) - 161;
    const act = ACTIVITY.find((x) => x.key === activity) ?? ACTIVITY[2];
    const tdee = bmr * act.factor;
    const healthyLow = 18.5 * Math.pow(h / 100, 2);
    const healthyHigh = 24.9 * Math.pow(h / 100, 2);
    return { bmi, cat, bmr, tdee, healthyLow, healthyHigh, lose: tdee - 500, gain: tdee + 500 };
  }, [height, weight, age, sex, activity]);

  const inputCls =
    "w-full glass rounded-xl px-4 py-3 text-lg font-mono outline-none focus:border-brand-500/60";
  const labelCls = "text-sm font-medium text-zinc-300 block mb-1.5";

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="space-y-5">
        <div className="flex items-center gap-2">
          <HeartPulse size={18} className="text-brand-400" />
          <h3 className="font-semibold">Your measurements</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Height (cm)</label>
            <input type="number" min={50} max={250} value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Weight (kg)</label>
            <input type="number" min={20} max={400} value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Age</label>
            <input type="number" min={10} max={120} value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sex</label>
            <div className="grid grid-cols-2 gap-2">
              {(["male", "female"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className={cn(
                    "py-3 rounded-xl text-sm font-medium border transition capitalize",
                    sex === s ? "bg-brand-600 text-white border-brand-500 shadow-glow" : "glass border-transparent text-zinc-400 hover:text-white"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Activity level</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ACTIVITY.map((a) => (
              <button
                key={a.key}
                onClick={() => setActivity(a.key)}
                className={cn(
                  "rounded-xl px-3 py-2.5 border text-left transition",
                  activity === a.key
                    ? "bg-brand-600/15 border-brand-500/50"
                    : "glass border-transparent hover:border-white/15"
                )}
              >
                <span className={cn("block text-sm font-medium", activity === a.key ? "text-white" : "text-zinc-300")}>{a.label}</span>
                <span className="block text-[11px] text-zinc-500">{a.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Body Mass Index</h3>
            {calc && <span className={cn("text-sm font-bold uppercase tracking-widest", calc.cat.color)}>{calc.cat.label}</span>}
          </div>
          {calc ? (
            <>
              <p className="font-display text-5xl font-extrabold text-gradient">{calc.bmi.toFixed(1)}</p>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mt-4 relative">
                <div className={cn("h-full rounded-full transition-all duration-500", calc.cat.bar)} style={{ width: `${calc.cat.width}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500 mt-1.5">
                <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
              </div>
              <p className="text-xs text-zinc-400 mt-3">
                Healthy weight for your height: <span className="text-white font-semibold">{calc.healthyLow.toFixed(1)}–{calc.healthyHigh.toFixed(1)} kg</span>
              </p>
            </>
          ) : (
            <p className="text-zinc-500 py-8 text-center">Enter height & weight.</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Flame size={18} className="text-accent-400" />
            <h3 className="font-semibold">Daily calories</h3>
          </div>
          {calc ? (
            <div className="space-y-2.5">
              {[
                { label: "Maintain weight", val: calc.tdee, hot: true },
                { label: "Lose ~0.5 kg/week", val: calc.lose },
                { label: "Gain ~0.5 kg/week", val: calc.gain },
              ].map((r) => (
                <div key={r.label} className={cn("flex items-center justify-between rounded-xl px-4 py-3", r.hot ? "bg-brand-600/15 border border-brand-500/40" : "glass")}>
                  <span className="text-sm text-zinc-300 flex items-center gap-2">
                    <Activity size={14} className="text-zinc-500" /> {r.label}
                  </span>
                  <span className="font-mono font-bold text-white">{Math.round(r.val).toLocaleString()} <span className="text-xs text-zinc-500 font-normal">kcal</span></span>
                </div>
              ))}
              <p className="text-[11px] text-zinc-500">
                BMR {Math.round(calc.bmr).toLocaleString()} kcal × activity factor. Estimates via Mifflin-St Jeor — not medical advice.
              </p>
            </div>
          ) : (
            <p className="text-zinc-500 py-8 text-center">Enter your details to see calorie targets.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
