"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
  PieChart as PieChartIcon,
  Settings2,
  Tag,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getViewerId } from "@/hooks/useTrackToolUsage";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENCY_SYMBOLS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  FINANCE_CURRENCIES,
} from "@/lib/finance";
import TransactionForm from "./TransactionForm";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  category: string;
  note: string | null;
  date: string; // YYYY-MM-DD
  created_at: string;
}

interface CustomCategory {
  id: string;
  name: string;
  type: "income" | "expense";
}

interface Identity {
  viewer: string;
  userId?: string;
}

const CHART_COLORS = [
  "#f97316", "#8b5cf6", "#06b6d4", "#ec4899", "#22c55e",
  "#eab308", "#3b82f6", "#ef4444", "#14b8a6", "#a855f7",
  "#f59e0b", "#10b981",
];

const selectCls =
  "w-full glass rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-white bg-transparent outline-none focus:border-brand-500/60 [&>option]:bg-white dark:[&>option]:bg-[#0b0b14]";

/* ------------------------------------------------------------------ */
/* API client                                                          */
/* ------------------------------------------------------------------ */

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.setupRequired) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}

const listTransactions = (id: Identity, filters: Record<string, string>) =>
  api(`/api/finance?${new URLSearchParams({ viewer: id.viewer, ...(id.userId ? { userId: id.userId } : {}), ...filters })}`);

const createTransaction = (id: Identity, payload: Record<string, unknown>) =>
  api("/api/finance", { method: "POST", body: JSON.stringify({ viewer: id.viewer, ...(id.userId ? { userId: id.userId } : {}), ...payload }) });

const updateTransaction = (id: Identity, txId: string, payload: Record<string, unknown>) =>
  api(`/api/finance/${txId}`, { method: "PATCH", body: JSON.stringify({ viewer: id.viewer, ...(id.userId ? { userId: id.userId } : {}), ...payload }) });

const deleteTransaction = (id: Identity, txId: string) =>
  api(`/api/finance/${txId}?${new URLSearchParams({ viewer: id.viewer, ...(id.userId ? { userId: id.userId } : {}) })}`, { method: "DELETE" });

const listCategories = (id: Identity) =>
  api(`/api/finance/categories?${new URLSearchParams({ viewer: id.viewer, ...(id.userId ? { userId: id.userId } : {}) })}`);

const createCategory = (id: Identity, name: string, type: "income" | "expense") =>
  api("/api/finance/categories", { method: "POST", body: JSON.stringify({ viewer: id.viewer, ...(id.userId ? { userId: id.userId } : {}), name, type }) });

const getSettings = (viewer: string) =>
  api(`/api/finance/settings?${new URLSearchParams({ viewer })}`);

const saveSettings = (id: Identity, currency: string) =>
  api("/api/finance/settings", { method: "POST", body: JSON.stringify({ viewer: id.viewer, ...(id.userId ? { userId: id.userId } : {}), currency }) });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtAmount(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function FinanceTracker() {
  const { toast } = useToast();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [currency, setCurrency] = useState("PKR");
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  // Filters
  const [month, setMonth] = useState(currentMonth());
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Form / delete state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Identity: viewer-id always; Supabase user when logged in (cross-device). */
  useEffect(() => {
    const viewer = getViewerId();
    setIdentity({ viewer });
    try {
      createClient()
        .auth.getUser()
        .then(({ data }) => {
          const u = data?.user;
          if (u?.id) setIdentity({ viewer, userId: u.id });
        })
        .catch(() => {});
    } catch {
      /* anonymous is fine */
    }
  }, []);

  const loadAll = useCallback(async (id: Identity, filters: Record<string, string>) => {
    const [txRes, catRes, setRes] = await Promise.all([
      listTransactions(id, filters),
      listCategories(id),
      getSettings(id.viewer),
    ]);
    if (txRes.setupRequired || catRes.setupRequired || setRes.setupRequired) {
      setSetupRequired(true);
      return;
    }
    setSetupRequired(false);
    setTransactions(txRes.transactions ?? []);
    setCustomCats(catRes.categories ?? []);
    if (setRes.currency) setCurrency(setRes.currency);
  }, []);

  const refresh = useCallback(() => {
    if (!identity) return;
    const filters: Record<string, string> = { month };
    if (typeFilter !== "all") filters.type = typeFilter;
    if (catFilter !== "all") filters.category = catFilter;
    if (search.trim()) filters.search = search.trim();
    setLoading(true);
    loadAll(identity, filters)
      .catch(() => toast({ title: "Could not load transactions", variant: "error" }))
      .finally(() => setLoading(false));
  }, [identity, month, typeFilter, catFilter, search, loadAll, toast]);

  useEffect(() => {
    if (!identity) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, search ? 350 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [identity, month, typeFilter, catFilter, search, refresh]);

  /* Dashboard totals (from the currently filtered list). */
  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of transactions) {
      const a = Number(t.amount) || 0;
      if (t.type === "income") income += a; else expense += a;
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const allCategories = useMemo(() => {
    const set = new Set<string>([...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]);
    for (const c of customCats) set.add(c.name);
    for (const t of transactions) set.add(t.category);
    return [...set].sort();
  }, [customCats, transactions]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      map.set(t.category, (map.get(t.category) ?? 0) + (Number(t.amount) || 0));
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions]);

  /* ------------------------------ actions ------------------------------ */

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t: Transaction) => { setEditing(t); setFormOpen(true); };

  const submitForm = async (draft: { id?: string; type: "income" | "expense"; amount: string; currency: string; category: string; note: string; date: string }) => {
    if (!identity) return;
    setFormBusy(true);
    try {
      if (draft.id) {
        await updateTransaction(identity, draft.id, {
          type: draft.type, amount: parseFloat(draft.amount), currency: draft.currency,
          category: draft.category, note: draft.note || null, date: draft.date,
        });
        toast({ title: "Transaction updated", variant: "success" });
      } else {
        await createTransaction(identity, {
          type: draft.type, amount: parseFloat(draft.amount), currency: draft.currency,
          category: draft.category, note: draft.note, date: draft.date,
        });
        toast({ title: "Transaction added", variant: "success" });
      }
      setFormOpen(false);
      refresh();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not save", variant: "error" });
    } finally {
      setFormBusy(false);
    }
  };

  const addCategory = async (name: string, type: "income" | "expense"): Promise<boolean> => {
    if (!identity) return false;
    try {
      const res = await createCategory(identity, name, type);
      if (res.setupRequired) { setSetupRequired(true); return false; }
      setCustomCats((p) => [...p, res.category]);
      return true;
    } catch {
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!identity || !deleteId) return;
    setDeleteBusy(true);
    try {
      await deleteTransaction(identity, deleteId);
      toast({ title: "Transaction deleted", variant: "success" });
      setDeleteId(null);
      refresh();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not delete", variant: "error" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const changeCurrency = async (cur: string) => {
    setCurrency(cur);
    if (!identity) return;
    try {
      const res = await saveSettings(identity, cur);
      if (res.setupRequired) setSetupRequired(true);
    } catch {
      /* display currency still updates locally */
    }
  };

  /* ------------------------------ render ------------------------------ */

  if (setupRequired) {
    return (
      <Card className="max-w-xl mx-auto text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <Settings2 size={22} />
        </div>
        <h3 className="font-semibold text-lg">Database setup required</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          The Finance Tracker needs its database tables. Please run the SQL migration
          <span className="font-mono text-xs"> supabase/migrations/014_finance_tracker.sql </span>
          once in your Supabase dashboard (SQL Editor), then reload this page.
        </p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-700 dark:text-brand-300">
            <Wallet size={20} />
          </span>
          <div>
            <h2 className="font-bold text-lg leading-tight">Finance Tracker</h2>
            <p className="text-xs text-zinc-500">{monthLabel(month)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Display currency"
            value={currency}
            onChange={(e) => changeCurrency(e.target.value)}
            className="!w-auto glass rounded-xl px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-white bg-transparent outline-none focus:border-brand-500/60 [&>option]:bg-white dark:[&>option]:bg-[#0b0b14]"
          >
            {FINANCE_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button size="sm" onClick={openAdd}>
            <Plus size={15} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">Balance</p>
          <p className={cn("text-lg sm:text-2xl font-bold mt-1", totals.balance >= 0 ? "text-zinc-900 dark:text-white" : "text-red-600 dark:text-red-400")}>
            {loading ? "…" : fmtAmount(totals.balance, currency)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 flex items-center gap-1">
            <ArrowUpCircle size={12} className="text-emerald-500" /> Income
          </p>
          <p className="text-lg sm:text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {loading ? "…" : fmtAmount(totals.income, currency)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 flex items-center gap-1">
            <ArrowDownCircle size={12} className="text-red-500" /> Expense
          </p>
          <p className="text-lg sm:text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {loading ? "…" : fmtAmount(totals.expense, currency)}
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <PieChartIcon size={17} className="text-brand-700 dark:text-brand-300" />
            <h3 className="font-semibold text-sm">Spending by category</h3>
          </div>
          {expenseByCategory.length === 0 ? (
            <p className="text-sm text-zinc-500 py-10 text-center">No expenses this period yet.</p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {expenseByCategory.map((e, i) => (
                        <Cell key={e.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => fmtAmount(v, currency)}
                      contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {expenseByCategory.map((e, i) => (
                  <li key={e.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="flex-1 text-zinc-600 dark:text-zinc-300 truncate">{e.name}</span>
                    <span className="font-semibold">{fmtAmount(e.value, currency)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Transactions */}
        <Card className="lg:col-span-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-zinc-400" />
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="glass rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-900 dark:text-white bg-transparent outline-none focus:border-brand-500/60"
                aria-label="Filter by month"
              />
            </div>
            <div className="flex rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
              {(["all", "income", "expense"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-3 py-2 text-xs font-semibold capitalize transition-colors",
                    typeFilter === t ? "bg-brand-500 text-white" : "text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="!w-auto glass rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-900 dark:text-white bg-transparent outline-none focus:border-brand-500/60 [&>option]:bg-white dark:[&>option]:bg-[#0b0b14]" aria-label="Filter by category">
              <option value="all">All categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[140px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="w-full glass rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-zinc-900 dark:text-white bg-transparent outline-none focus:border-brand-500/60 placeholder:text-zinc-400"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-2.5 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-3">
                <Wallet size={22} />
              </div>
              <p className="font-semibold text-sm">No transactions yet</p>
              <p className="text-xs text-zinc-500 mt-1 mb-4">Add your first income or expense to get started.</p>
              <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" /> Add transaction</Button>
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
              {transactions.map((t) => (
                <li key={t.id} className="py-3 flex items-center gap-3">
                  <span className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    t.type === "income" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"
                  )}>
                    {t.type === "income" ? <ArrowUpCircle size={17} /> : <ArrowDownCircle size={17} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{t.note || t.category}</p>
                    <p className="text-[11px] text-zinc-500">{t.category} · {fmtDate(t.date)}</p>
                  </div>
                  <p className={cn("text-sm font-bold shrink-0", t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {t.type === "income" ? "+" : "−"}{fmtAmount(Number(t.amount), t.currency || currency)}
                  </p>
                  <div className="flex shrink-0">
                    <button onClick={() => openEdit(t)} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition" aria-label="Edit transaction">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(t.id)} className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-black/5 dark:hover:bg-white/10 transition" aria-label="Delete transaction">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Add / edit modal */}
      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing ? {
          id: editing.id,
          type: editing.type,
          amount: String(editing.amount),
          currency: editing.currency || currency,
          category: editing.category,
          note: editing.note ?? "",
          date: editing.date,
        } : null}
        defaultCurrency={currency}
        customCategories={customCats}
        onAddCategory={addCategory}
        onSubmit={submitForm}
        busy={formBusy}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleteId !== null}
        title="Delete transaction?"
        message="This transaction will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        busy={deleteBusy}
        busyLabel="Deleting…"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
