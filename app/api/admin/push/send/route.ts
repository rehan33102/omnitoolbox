import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { sendPushToAll } from "@/lib/push";
import { logActivity } from "@/lib/activity";

const sendSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(200),
  url: z
    .string()
    .max(500)
    .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "URL must be a site path or http(s) URL")
    .optional()
    .default("/"),
});

async function guard(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:push:send", max: 10 });
  if (sec) return sec;
  if (!(await requirePermission("settings"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Admin: broadcast a push notification to all subscribers. */
export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = sendSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  try {
    const result = await sendPushToAll(parsed.data.title.trim(), parsed.data.body.trim(), parsed.data.url);
    await logActivity(
      "push.sent",
      `Push "${parsed.data.title.slice(0, 60)}" → ${result.sent}/${result.total} delivered${result.pruned ? `, ${result.pruned} pruned` : ""}`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
