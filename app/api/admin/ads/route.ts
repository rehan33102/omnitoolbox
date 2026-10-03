import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth";

const adSchema = z.object({
  placement: z.string().min(1).max(80),
  type: z.enum(["adsense", "banner", "affiliate"]),
  slotId: z.string().max(40).optional().default(""),
  imageUrl: z.string().max(500).optional().default(""),
  linkUrl: z.string().max(500).optional().default(""),
  html: z.string().max(5000).optional().default(""),
});

async function guard() {
  if (!(await requireAdminApi())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const supabase = createAdminClient();
  const { data } = await supabase.from("ad_configs").select("*").order("created_at", { ascending: false });
  const ads = (data ?? []).map((a) => ({
    id: a.id,
    placement: a.placement,
    type: a.type,
    slotId: a.slot_id,
    imageUrl: a.image_url,
    linkUrl: a.link_url,
    html: a.html,
    enabled: a.enabled,
  }));
  return NextResponse.json({ ads });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = adSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const a = parsed.data;
  const supabase = createAdminClient();
  const { error } = await supabase.from("ad_configs").insert({
    placement: a.placement,
    type: a.type,
    slot_id: a.slotId || null,
    image_url: a.imageUrl || null,
    link_url: a.linkUrl || null,
    html: a.html || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const { id, enabled } = await req.json().catch(() => ({}));
  if (!id || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("ad_configs").update({ enabled }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("ad_configs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
