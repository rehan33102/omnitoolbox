import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKV, setKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";
import { getSessionUser, invalidateRoleCache } from "@/lib/auth";
import { setUserRole, isRole } from "@/lib/permissions";
import { INVITES_KEY, type Invite } from "@/lib/invites";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(16).max(128) });

/**
 * POST /api/invites/redeem — public. Called by the signup page right after a
 * successful registration+sign-in with ?invite=TOKEN.
 *
 * Validates the invite (exists, not expired, not used) and that the signed-in
 * user's email matches the invited email, then marks the invite used and
 * applies the invited role. Returns only this invite's { email, role } —
 * never the full invite list.
 */
export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const invites = await getKV<Invite[]>(INVITES_KEY, []);
  const invite = (Array.isArray(invites) ? invites : []).find((i) => i.token === body.data.token);
  if (!invite) return NextResponse.json({ error: "Invite not found or revoked" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "Invite already used" }, { status: 410 });
  if (Date.now() > +new Date(invite.expiresAt)) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }
  if (!isRole(invite.role)) return NextResponse.json({ error: "Invite has an invalid role" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to redeem this invite" }, { status: 401 });
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: "This invite was sent to a different email address" }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();
    // Mark used first so a retry can't double-apply.
    const next = (Array.isArray(invites) ? invites : []).map((i) =>
      i.id === invite.id ? { ...i, usedAt: new Date().toISOString() } : i
    );
    await setKV(INVITES_KEY, next);

    await setUserRole(user.id, invite.role);
    // Sync the profiles column when the DB constraint allows it — middleware
    // only reads profiles, so invited admins need role=admin there to reach /admin.
    if (invite.role === "admin" || invite.role === "user") {
      await supabase
        .from("profiles")
        .upsert({ id: user.id, email: user.email, role: invite.role }, { onConflict: "id" });
    }
    invalidateRoleCache(user.id);

    await logActivity("invite.redeemed", `Invite redeemed by ${user.email} as ${invite.role}`, user.email);
    return NextResponse.json({ ok: true, email: invite.email, role: invite.role });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
