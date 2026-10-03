"use client";

import { useMemo, useState } from "react";
import { Cake, CalendarDays, Clock3 } from "lucide-react";
import Card from "@/components/ui/Card";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AgeCalculator() {
  const [dob, setDob] = useState("2000-01-01");

  const calc = useMemo(() => {
    if (!dob) return null;
    const birth = new Date(dob + "T00:00:00");
    if (isNaN(birth.getTime()) || birth > new Date()) return null;
    const now = new Date();

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();
    if (days < 0) {
      months -= 1;
      days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const diffMs = now.getTime() - birth.getTime();
    const totalDays = Math.floor(diffMs / 86400000);
    const totalHours = Math.floor(diffMs / 3600000);
    const totalMinutes = Math.floor(diffMs / 60000);
    const bornOn = WEEKDAYS[birth.getDay()];

    // Next birthday
    const thisYear = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
    const next = thisYear >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
      ? thisYear
      : new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
    const daysToBday = Math.ceil((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
    const turning = next.getFullYear() - birth.getFullYear();

    return { years, months, days, totalDays, totalHours, totalMinutes, bornOn, daysToBday, turning, nextDate: next };
  }, [dob]);

  const stat = (label: string, value: string) => (
    <div className="glass rounded-xl px-4 py-3 text-center">
      <p className="font-mono text-xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-zinc-500 mt-0.5">{label}</p>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="space-y-5">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-brand-400" />
          <h3 className="font-semibold">Date of birth</h3>
        </div>
        <input
          type="date"
          value={dob}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => setDob(e.target.value)}
          className="w-full glass rounded-xl px-4 py-3.5 text-lg outline-none focus:border-brand-500/60 [color-scheme:dark]"
        />
        <p className="text-[11px] text-zinc-500">
          Everything is calculated instantly in your browser — your birth date never leaves this page.
        </p>

        {calc && (
          <div className="glass rounded-2xl p-5 text-center bg-gradient-to-b from-brand-600/10 to-transparent">
            <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">You are</p>
            <p className="font-display text-4xl font-extrabold">
              <span className="text-gradient">{calc.years}</span>
              <span className="text-lg text-zinc-400 font-semibold"> yrs </span>
              <span className="text-gradient">{calc.months}</span>
              <span className="text-lg text-zinc-400 font-semibold"> mo </span>
              <span className="text-gradient">{calc.days}</span>
              <span className="text-lg text-zinc-400 font-semibold"> days</span>
            </p>
            <p className="text-xs text-zinc-500 mt-2">Born on a {calc.bornOn} 🎂</p>
          </div>
        )}
      </Card>

      <div className="space-y-5">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Clock3 size={18} className="text-accent-400" />
            <h3 className="font-semibold">In total</h3>
          </div>
          {calc ? (
            <div className="grid grid-cols-3 gap-2.5">
              {stat("Days", calc.totalDays.toLocaleString())}
              {stat("Hours", calc.totalHours.toLocaleString())}
              {stat("Minutes", calc.totalMinutes.toLocaleString())}
            </div>
          ) : (
            <p className="text-zinc-500 py-8 text-center">Pick a valid date of birth.</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Cake size={18} className="text-brand-400" />
            <h3 className="font-semibold">Next birthday</h3>
          </div>
          {calc ? (
            <div className="text-center py-2">
              {calc.daysToBday === 0 ? (
                <p className="font-display text-2xl font-extrabold text-gradient">🎉 Happy Birthday! 🎉</p>
              ) : (
                <>
                  <p className="font-display text-4xl font-extrabold text-gradient">{calc.daysToBday}</p>
                  <p className="text-sm text-zinc-400 mt-1">days until you turn {calc.turning}</p>
                </>
              )}
              <p className="text-xs text-zinc-500 mt-2">
                {calc.nextDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          ) : (
            <p className="text-zinc-500 py-8 text-center">—</p>
          )}
        </Card>
      </div>
    </div>
  );
}
