import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { getKV, setKV } from "@/lib/kv";
import { logActivity } from "@/lib/activity";
import { DEFAULT_ANNOUNCEMENT, type SiteAnnouncement } from "@/lib/announcement";

const announcementSchema = z.object({
  text: z.string().min(1).max(200),
  linkUrl: z
    .string()
    .max(500)
    .refine(
      (v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v),
      "Link must be a site path (e.g. /blog) or an http(s) URL"
    )
    .optional()
    .default(""),
  enabled: z.boolean(),
});

async function guard(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:announcement", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("settings"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Admin: read the current announcement. */
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const announcement = await getKV<SiteAnnouncement>("site_announcement", DEFAULT_ANNOUNCEMENT);
  return NextResponse.json({ announcement });
}

/** Admin: create/replace the announcement. */
export async function PUT(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = announcementSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  const announcement: SiteAnnouncement = {
    id: `ann-${Date.now()}`,
    text: parsed.data.text.trim(),
    linkUrl: parsed.data.linkUrl?.trim() ?? "",
    enabled: parsed.data.enabled,
  };
  const ok = await setKV("site_announcement", announcement);
  if (!ok) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  await logActivity(
    "announcement.updated",
    `Announcement ${announcement.enabled ? "enabled" : "disabled"}: "${announcement.text.slice(0, 80)}"`
  );
  return NextResponse.json({ ok: true, announcement });
}
