import { NextRequest, NextResponse } from "next/server";
import { getActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";

/** GET /api/admin/activity — recent admin activity log entries (admin only). */
export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:activity", max: 30 });
  if (sec) return sec;
  if (!(await requirePermission("activity"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const entries = await getActivity(200);
  return NextResponse.json({ entries });
}
