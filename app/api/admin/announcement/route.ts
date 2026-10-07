import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import {
  getAnnouncements,
  saveAnnouncements,
  type SiteAnnouncement,
} from "@/lib/announcement";
import { logActivity } from "@/lib/activity";

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
  enabled: z.boolean().optional().default(true),
});

async function guard(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:announcement", max: 60 });
  if (sec) return sec;
  if (!(await requirePermission("settings"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Admin: read all announcements (newest first; runs legacy migration). */
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const announcements = await getAnnouncements();
  return NextResponse.json({ announcements });
}

/** Admin: create a NEW announcement. Never replaces existing ones. */
export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const parsed = announcementSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  const list = await getAnnouncements();
  const announcement: SiteAnnouncement = {
    id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: parsed.data.text.trim(),
    linkUrl: parsed.data.linkUrl?.trim() ?? "",
    enabled: parsed.data.enabled,
    createdAt: new Date().toISOString(),
  };
  // Prepend: newest first.
  const ok = await saveAnnouncements([announcement, ...list]);
  if (!ok) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  await logActivity(
    "announcement.created",
    `Announcement created (${announcement.enabled ? "enabled" : "disabled"}): "${announcement.text.slice(0, 80)}"`
  );
  return NextResponse.json({ ok: true, announcement, announcements: [announcement, ...list] }, { status: 201 });
}
