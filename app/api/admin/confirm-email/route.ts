import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Manually confirm a user's email (bypasses email delivery issues).
 * Only for the site owner.
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (email?.toLowerCase() !== "rehan.work3310@gmail.com") {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: users } = await admin.auth.admin.listUsers();
    const user = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json({ error: "User not found. Signup pehle karo." }, { status: 404 });
    }

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true, message: "Email confirmed! Ab login karo." });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
