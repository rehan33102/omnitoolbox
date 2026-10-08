"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Tag } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  FINANCE_CURRENCIES,
} from "@/lib/finance";
import type { CustomCategoryLike } from "./types";

const selectCls =
  "w-full glass rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-white bg-transparent outline-none focus:border-brand-500/60 [&>option]:bg-white dark:[&>option]:bg-[#0b0b14]";

export interface TxDraft {
  id?: string;
  type: "income" | "expense";
  amount: string;
  currency: string;
  category: string;
  note: string;
  date: string;
}

export default function TransactionForm({
  open,
  onClose,
  initial,
  defaultCurrency,
  customCategories,
  onAddCategory,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  initial: TxDraft | null;
  defaultCurrency: string;
  customCategories: CustomCategoryLike[];
  onAddCategory: (name: string, type: "income" | "expense") => Promise<boolean>;
  onSubmit: (draft: TxDraft) => void;
  busy: boolean;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setType(initial?.type ?? "expense");
      setAmount(initial?.amount ?? "");
      setCurrency(initial?.currency ?? defaultCurrency);
      setCategory(initial?.category ?? "");
      setNote(initial?.note ?? "");
      setDate(initial?.date ?? new Date().toISOString().slice(0, 10));
      setErrors({});
      setShowNewCat(false);
      setNewCat("");
    }
  }, [open, initial, defaultCurrency]);

  const categories = useMemo((): string[] => {
    const defaults: string[] = type === "income" ? [...DEFAULT_INCOME_CATEGORIES] : [...DEFAULT_EXPENSE_CATEGORIES];
    const custom = customCategories.filter((c) => c.type === type).map((c) => c.name);
    const merged = [...defaults];
    for (const c of custom) if (!merged.includes(c)) merged.push(c);
    return merged;
  }, [type, customCategories]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0] ?? "Other");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const submit = () => {
    const errs: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = "Enter an amount greater than 0";
    if (!category) errs.category = "Pick a category";
    if (!date) errs.date = "Pick a date";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ id: initial?.id, type, amount: amt.toFixed(2), currency, category, note: note.trim(), date });
  };

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    if (categories.includes(name)) {
      toast({ title: "Category already exists", variant: "info" });
      return;
    }
    const ok = await onAddCategory(name, type);
    if (ok) {
      setCategory(name);
      setNewCat("");
      setShowNewCat(false);
      toast({ title: "Category added", variant: "success" });
    } else {
      toast({ title: "Could not add category", variant: "error" });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? "Edit transaction" : "Add transaction"} wide>
      <div className="space-y-4">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "rounded-xl py-2.5 text-sm font-semibold transition-all",
                type === t
                  ? t === "expense"
                    ? "bg-red-500 text-white shadow"
                    : "bg-emerald-500 text-white shadow"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {t === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
          />
          <div>
            <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls}>
              {FINANCE_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3.5 py-2 rounded-full text-xs font-semibold transition-all border",
                  category === c
                    ? "bg-brand-500 text-white border-brand-500 shadow"
                    : "border-black/10 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-brand-500/50"
                )}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNewCat((s) => !s)}
              className="px-3.5 py-2 rounded-full text-xs font-semibold border border-dashed border-black/20 dark:border-white/20 text-zinc-500 dark:text-zinc-400 hover:border-brand-500/60 flex items-center gap-1"
            >
              <Plus size={13} /> New
            </button>
          </div>
          {errors.category && <span className="block text-xs text-red-600 dark:text-red-400 mt-1.5">{errors.category}</span>}
          {showNewCat && (
            <div className="flex gap-2 mt-2">
              <Input placeholder="Category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <Button size="sm" onClick={addCategory} className="shrink-0">
                <Tag size={14} className="mr-1" /> Add
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Note (optional)"
            placeholder="e.g. Grocery run"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
          />
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : initial?.id ? "Save changes" : "Add transaction"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
