import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { getPushConfig, generatePushConfig, getSubscriptions } from "@/lib/push";
import { logActivity } from "@/lib/activity";

async function guard(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:push", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("settings"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Admin: push status — configured?, public key, subscriber count. */
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const cfg = await getPushConfig();
  const subs = await getSubscriptions();
  return NextResponse.json({
    configured: !!cfg,
    publicKey: cfg?.publicKey ?? null,
    subscriberCount: subs.length,
  });
}

/** Admin: generate (or regenerate) VAPID keys, stored server-side in KV. */
export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const cfg = await generatePushConfig();
    await logActivity("push.keys_generated", "VAPID push keys generated");
    return NextResponse.json({ ok: true, publicKey: cfg.publicKey });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
