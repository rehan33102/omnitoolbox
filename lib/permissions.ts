/**
 * lib/permissions.ts — Meta-style role & permission model for the admin area.
 *
 * Model (mirrors Meta Business Suite's People management, minus asset-level
 * assignment which a tools site doesn't need):
 *   - Roles: admin (full control) | moderator (partial, section-based) |
 *     user (no dashboard access) | banned (blocked everywhere).
 *   - People are invited by email with a role; invites are pending until
 *     redeemed, and can be revoked. Every change is activity-logged.
 *
 * Storage: extended roles live in KV (`user_roles` on the existing
 * seo_settings table) — NOT the profiles.role column, which carries a DB
 * check constraint role in ('admin','user') that cannot be altered from the app.
 * Section overrides live in KV `role_permissions` (per-role section lists that
 * replace the defaults below when present).
 *
 * SERVER-ONLY: uses the service-role client via lib/kv. Never import into
 * client components — the browser gets roles/permissions via /api/admin/me.
 */
import { getKV, setKV } from "@/lib/kv";
import { getSessionUser, invalidateRoleCache, type SessionUser } from "@/lib/auth";

export type Role = "admin" | "moderator" | "user" | "banned";

export type Section =
  | "dashboard"
  | "users"
  | "tools"
  | "blog"
  | "monetization"
  | "seo"
  | "media"
  | "settings"
  | "health"
  | "activity";

export const ROLES: Role[] = ["admin", "moderator", "user", "banned"];

export const SECTIONS: Section[] = [
  "dashboard",
  "users",
  "tools",
  "blog",
  "monetization",
  "seo",
  "media",
  "settings",
  "health",
  "activity",
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  moderator: "Moderator",
  user: "User",
  banned: "Banned",
};

export const SECTION_LABELS: Record<Section, string> = {
  dashboard: "Dashboard",
  users: "Users",
  tools: "Tools",
  blog: "Blog",
  monetization: "Monetization",
  seo: "SEO",
  media: "Media",
  settings: "Settings",
  health: "Health",
  activity: "Activity",
};

export const USER_ROLES_KEY = "user_roles";
const ROLE_PERMISSIONS_KEY = "role_permissions";

/** Default permission matrix. Admin = full control; moderator = partial access. */
const DEFAULT_MATRIX: Record<Role, Section[]> = {
  admin: [...SECTIONS],
  moderator: ["dashboard", "tools", "blog", "monetization", "media", "activity"],
  user: [],
  banned: [],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function isSection(value: unknown): value is Section {
  return typeof value === "string" && (SECTIONS as string[]).includes(value);
}

/** Extended role for a user id (KV override), or null when none is set. */
export async function getUserRole(userId: string): Promise<Role | null> {
  const overrides = await getKV<Record<string, unknown>>(USER_ROLES_KEY, {});
  const raw = overrides?.[userId];
  return isRole(raw) ? raw : null;
}

/** Persist an extended role. Also clears the per-request role cache in lib/auth. */
export async function setUserRole(userId: string, role: Role): Promise<boolean> {
  const overrides = await getKV<Record<string, unknown>>(USER_ROLES_KEY, {});
  const next: Record<string, unknown> = { ...(overrides ?? {}) };
  next[userId] = role;
  const ok = await setKV(USER_ROLES_KEY, next);
  if (ok) invalidateRoleCache(userId);
  return ok;
}

/** Remove the extended role for a user (e.g. after account deletion). */
export async function clearUserRole(userId: string): Promise<boolean> {
  const overrides = await getKV<Record<string, unknown>>(USER_ROLES_KEY, {});
  if (!overrides || !(userId in overrides)) return true;
  const next: Record<string, unknown> = { ...overrides };
  delete next[userId];
  const ok = await setKV(USER_ROLES_KEY, next);
  if (ok) invalidateRoleCache(userId);
  return ok;
}

/**
 * Effective section list for a role: defaults deep-merged with the admin's
 * KV overrides (`role_permissions`). An override replaces the section list
 * for that role (unknown section names are dropped).
 */
export async function getPermissionsFor(role: Role): Promise<Section[]> {
  const overrides = await getKV<Partial<Record<Role, unknown>>>(ROLE_PERMISSIONS_KEY, {});
  const raw = overrides?.[role];
  if (Array.isArray(raw)) {
    const cleaned = raw.filter(isSection);
    // An explicitly-set empty array means "no access" — respect it.
    return [...new Set(cleaned)];
  }
  return [...DEFAULT_MATRIX[role]];
}

/** Replace the section list for a role (admin override of the default matrix). */
export async function setPermissionsFor(role: Role, sections: Section[]): Promise<boolean> {
  const overrides = await getKV<Partial<Record<Role, Section[]>>>(ROLE_PERMISSIONS_KEY, {});
  const next: Partial<Record<Role, Section[]>> = { ...(overrides ?? {}) };
  next[role] = [...new Set(sections.filter(isSection))];
  return setKV(ROLE_PERMISSIONS_KEY, next);
}

export async function hasPermission(role: Role, section: Section): Promise<boolean> {
  const sections = await getPermissionsFor(role);
  return sections.includes(section);
}

/**
 * API-level guard: returns the session user when they may access `section`,
 * otherwise null (caller responds 403). Banned users are always denied.
 * Drop-in replacement for requireAdminApi with section granularity.
 */
export async function requirePermission(section: Section): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role === "banned") return null;
  if (!(await hasPermission(user.role, section))) return null;
  return user;
}
