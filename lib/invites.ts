/**
 * lib/invites.ts — shared invite types/constants for the invite system.
 *
 * Lives here (not in a route module) because Next.js route files may only
 * export valid route fields; importing from a route module also breaks the
 * route type check. Both /api/admin/invites and /api/invites/redeem use this.
 */
import type { Role } from "@/lib/permissions";

export const INVITES_KEY = "user_invites";

export interface Invite {
  id: string;
  email: string;
  role: Role;
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  createdBy: string;
}
