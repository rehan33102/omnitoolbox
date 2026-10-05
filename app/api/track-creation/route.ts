import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  kind: z.enum(["voiceover", "image", "qr", "pdf", "video"]),
  name: z.string().min(1).max(255),
  toolSlug: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    // Get logged-in user (optional — anonymous creations are still logged)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const admin = createAdminClient();
    await admin.from("user_creations").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      kind: body.data.kind,
      name: body.data.name,
      tool_slug: body.data.toolSlug ?? null,
    });
  } catch {
    /* tracking must never break UX */
  }
  return NextResponse.json({ ok: true });
}
