import { createAdminClient } from "@/lib/supabase/admin";

/**
 * True when the error means the finance backend isn't usable yet:
 * tables haven't been migrated (42P01), Supabase isn't configured,
 * or the database is unreachable. In all these cases the UI should
 * show the setup guidance instead of crashing.
 */
export function isBackendUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.code ?? ""} ${error.message ?? ""}`;
  return (
    error.code === "42P01" ||
    /relation .* does not exist/i.test(msg) ||
    /supabaseurl is required|supabasekey is required/i.test(msg) ||
    /fetch failed|network|econnrefused|enotfound|timeout/i.test(msg)
  );
}

/** @deprecated use isBackendUnavailable */
export const isMissingTable = isBackendUnavailable;

export interface FinanceScope {
  viewerId: string | null;
  userId: string | null;
}

/**
 * Build an OR filter matching rows belonging to this visitor:
 * same browser viewer-id OR same logged-in user id.
 */
export function scopeFilter(scope: FinanceScope): string {
  const parts: string[] = [];
  if (scope.viewerId) parts.push(`viewer_id.eq.${scope.viewerId}`);
  if (scope.userId) parts.push(`user_id.eq.${scope.userId}`);
  // Always at least one part — callers validate viewerId presence.
  return parts.join(",");
}

export function financeDb() {
  return createAdminClient();
}

export const FINANCE_CURRENCIES = ["PKR", "USD", "EUR", "INR", "GBP", "AED"] as const;
export type FinanceCurrency = (typeof FINANCE_CURRENCIES)[number];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Entertainment",
  "Investment",
  "Other",
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  "Salary",
  "Business",
  "Investment",
  "Other",
] as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  PKR: "Rs",
  USD: "$",
  EUR: "€",
  INR: "₹",
  GBP: "£",
  AED: "AED ",
};
