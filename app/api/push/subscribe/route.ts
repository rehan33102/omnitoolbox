import { NextRequest, NextResponse } from "next/server";
import { guardApi } from "@/lib/api-security";
import { getPushConfig, addSubscription, type StoredSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Public: expose the VAPID public key so browsers can subscribe. */
export async function GET() {
  const cfg = await getPushConfig();
  return NextResponse.json(
    { publicKey: cfg?.publicKey ?? null, configured: !!cfg },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

/** Public: register a browser push subscription. */
export async function POST(req: NextRequest) {
  const sec = guardApi(req, { key: "push:subscribe", max: 20, skipOriginCheck: true });
  if (sec) return sec;
  const sub = (await req.json().catch(() => null)) as StoredSubscription | null;
  if (!sub?.endpoint || typeof sub.endpoint !== "string" || sub.endpoint.length > 2000) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const keys = sub.keys;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
    return NextResponse.json({ error: "Invalid subscription keys" }, { status: 400 });
  }
  const ok = await addSubscription({ endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  if (!ok) return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
