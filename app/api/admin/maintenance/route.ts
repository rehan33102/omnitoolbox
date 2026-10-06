import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { getKV, setKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const KEY = "maintenance_mode";

const schema = z.object({ enabled: z.boolean() });

async function guard(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:maintenance", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Admin: read maintenance mode. */
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const enabled = await getKV<boolean>(KEY, false);
  return NextResponse.json({ enabled: !!enabled });
}

/** Admin: toggle maintenance mode. */
export async function PUT(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const ok = await setKV(KEY, parsed.data.enabled);
  if (!ok) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  await logActivity(
    "maintenance.toggled",
    `Maintenance mode ${parsed.data.enabled ? "ENABLED" : "DISABLED"}`
  );
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
