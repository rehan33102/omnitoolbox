import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "rehan-setup-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = createAdminClient();
    const email = "rehan.work3310@gmail.com";

    const { data: listData } = await supabase.auth.admin.listUsers();
    const user = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let profile = null;
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = data;
    }

    return NextResponse.json({
      userExists: !!user,
      userId: user?.id ?? null,
      emailConfirmed: user?.email_confirmed_at ?? null,
      profile,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
