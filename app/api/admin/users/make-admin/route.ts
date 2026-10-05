import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  id: z.string().uuid(),
  makeAdmin: z.boolean(),
});

export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const supabase = createAdminClient();
    // Get user's email from auth (profiles.email is NOT NULL)
    const { data: userData } = await supabase.auth.admin.getUserById(body.data.id);
    const email = userData?.user?.email ?? "";
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { id: body.data.id, email, role: body.data.makeAdmin ? "admin" : "user" },
        { onConflict: "id" }
      );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
