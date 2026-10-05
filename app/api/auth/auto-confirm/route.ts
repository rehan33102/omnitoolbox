import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Auto-confirms a user's email after signup (OTP system removed).
 * Called by the signup flow to instantly activate accounts.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Find user by email
    const { data: listData } = await supabase.auth.admin.listUsers();
    const user = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Auto-confirm email
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (error) throw error;

    // Ensure profile exists
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email, role: "user" },
      { onConflict: "id", ignoreDuplicates: false }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
