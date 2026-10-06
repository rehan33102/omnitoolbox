import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getKV, setKV } from "@/lib/kv";
import { siteUrl } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { INVITES_KEY, type Invite } from "@/lib/invites";
import { requirePermission, isRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function readInvites(): Promise<Invite[]> {
  const invites = await getKV<Invite[]>(INVITES_KEY, []);
  return Array.isArray(invites) ? invites : [];
}

const createSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(["admin", "moderator", "user", "banned"]),
});

/**
 * GET /api/admin/invites — list all invites, newest first (users-section permission).
 * Pending invites include their signup link so the admin can copy/share it.
 */
export async function GET() {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invites = (await readInvites()).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return NextResponse.json({
    invites: invites.map((i) => ({
      ...i,
      link: `${siteUrl("/signup")}?invite=${i.token}`,
      expired: !i.usedAt && Date.now() > +new Date(i.expiresAt),
    })),
  });
}

/**
 * POST /api/admin/invites — create an invite (users-section permission).
 * Body: { email, role }. The invitee signs up via the returned link and the
 * role is applied automatically on redeem. Refuses to invite an owner email
 * as non-admin (owners are always admin anyway).
 */
export async function POST(req: NextRequest) {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Valid email and role required" }, { status: 400 });

  const email = body.data.email.trim().toLowerCase();
  const role = body.data.role;
  if (!isRole(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const invites = await readInvites();
  const existing = invites.find(
    (i) => i.email === email && !i.usedAt && Date.now() <= +new Date(i.expiresAt)
  );
  if (existing) {
    return NextResponse.json({ error: "A pending invite already exists for this email" }, { status: 409 });
  }

  const now = Date.now();
  const invite: Invite = {
    id: `${now}-${randomBytes(6).toString("hex")}`,
    email,
    role,
    token: randomBytes(16).toString("hex"), // 32 chars
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
    usedAt: null,
    createdBy: admin.email,
  };
  invites.unshift(invite);
  const ok = await setKV(INVITES_KEY, invites.slice(0, 200));
  if (!ok) return NextResponse.json({ error: "Failed to save invite" }, { status: 500 });

  await logActivity("invite.created", `Invite created for ${email} as ${role}`, admin.email);
  return NextResponse.json({
    ok: true,
    invite: { ...invite, link: `${siteUrl("/signup")}?invite=${invite.token}` },
  });
}

/**
 * DELETE /api/admin/invites?id=… — revoke an invite (users-section permission).
 */
export async function DELETE(req: NextRequest) {
  const admin = await requirePermission("users");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const invites = await readInvites();
  const target = invites.find((i) => i.id === id);
  if (!target) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const ok = await setKV(
    INVITES_KEY,
    invites.filter((i) => i.id !== id)
  );
  if (!ok) return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });

  await logActivity("invite.revoked", `Invite revoked for ${target.email} (${target.role})`, admin.email);
  return NextResponse.json({ ok: true });
}
