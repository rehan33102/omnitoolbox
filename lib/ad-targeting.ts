/**
 * lib/ad-targeting.ts — pure (storage/DOM-free) helpers for popup-ad
 * eligibility: schedule windows, device targeting, and the calendar-day key
 * used for "once per day" frequency. Shared by AdPopup and unit-testable.
 */
import type { AdDevices } from "./ad-options";

/** True when `nowMs` is inside the ad's optional [scheduleStart, scheduleEnd] window. */
export function adScheduleActive(
  scheduleStart: string | null | undefined,
  scheduleEnd: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const start = scheduleStart ? Date.parse(scheduleStart) : NaN;
  const end = scheduleEnd ? Date.parse(scheduleEnd) : NaN;
  if (!Number.isNaN(start) && start > nowMs) return false; // not started yet
  if (!Number.isNaN(end) && end < nowMs) return false; // already expired
  return true;
}

/**
 * True when the ad's device targeting matches the current viewport.
 * `isMobileViewport` = matchMedia("(max-width: 767px)").matches — injected
 * so this stays pure and testable.
 */
export function adDeviceMatches(
  devices: AdDevices | string | null | undefined,
  isMobileViewport: boolean
): boolean {
  if (!devices || devices === "all") return true;
  if (devices === "mobile") return isMobileViewport;
  if (devices === "desktop") return !isMobileViewport;
  return true; // unknown value — fail open, never hide an ad by accident
}

/** Local-calendar-day key ("YYYY-MM-DD") for the "once per day" frequency. */
export function adDayString(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Storage keys for per-frequency dismissal. */
export function adSessionDismissKey(id: string): string {
  return `otb-ad-dismissed-${id}`;
}
export function adDayDismissKey(id: string): string {
  return `otb-ad-dismissed-day-${id}`;
}
