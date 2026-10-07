import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import {
  getAnnouncements,
  saveAnnouncements,
} from "@/lib/announcement";
import { logActivity } from "@/lib/activity";

const updateSchema = z.object({
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
});

const toggleSchema = z.object({
  enabled: z.boolean(),
});

async function guard(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:announcement", max: 60 });
  if (sec) return sec;
  if (!(await requirePermission("settings"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

type Ctx = { params: Promise<{ id: string }> };

/** Admin: update one announcement's text/link. Other announcements untouched. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const denied = await guard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  const list = await getAnnouncements();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  const updated = {
    ...list[idx],
    text: parsed.data.text.trim(),
    linkUrl: parsed.data.linkUrl?.trim() ?? "",
  };
  const next = [...list];
  next[idx] = updated;
  const ok = await saveAnnouncements(next);
  if (!ok) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  await logActivity("announcement.updated", `Announcement updated: "${updated.text.slice(0, 80)}"`);
  return NextResponse.json({ ok: true, announcement: updated, announcements: next });
}

/** Admin: toggle ONE announcement's enabled flag. Nothing else changes. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await guard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = toggleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  const list = await getAnnouncements();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  const updated = { ...list[idx], enabled: parsed.data.enabled };
  const next = [...list];
  next[idx] = updated;
  const ok = await saveAnnouncements(next);
  if (!ok) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  await logActivity(
    "announcement.toggled",
    `Announcement ${updated.enabled ? "enabled" : "disabled"}: "${updated.text.slice(0, 80)}"`
  );
  return NextResponse.json({ ok: true, announcement: updated, announcements: next });
}

/** Admin: delete ONE announcement. Others are never affected. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await guard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const list = await getAnnouncements();
  const target = list.find((a) => a.id === id);
  if (!target) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  const next = list.filter((a) => a.id !== id);
  const ok = await saveAnnouncements(next);
  if (!ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  await logActivity("announcement.deleted", `Announcement deleted: "${target.text.slice(0, 80)}"`);
  return NextResponse.json({ ok: true, announcements: next });
}
