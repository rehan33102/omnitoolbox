import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * ONE-TIME setup: creates the owner admin account bypassing rate limits.
 * DELETE THIS FILE after use.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  // Simple protection - must know the secret
  if (secret !== "rehan-setup-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const email = "rehan.work3310@gmail.com";
    const password = "Admin123456";

    // Check if user already exists
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;
    if (existing) {
      userId = existing.id;
      // Update password and confirm
      await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: "Rehan" },
      });
      if (error) throw error;
      userId = data.user.id;
    }

    // Make admin in profiles
    await supabase.from("profiles").upsert(
      { id: userId, email, role: "admin" },
      { onConflict: "id" }
    );

    return NextResponse.json({
      ok: true,
      email,
      message: "Admin account ready. Login with the password: Admin123456",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
