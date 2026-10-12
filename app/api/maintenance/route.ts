import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";

export const dynamic = "force-dynamic";

const KEY = "maintenance_mode";

/** Public: is maintenance mode on? */
export async function GET() {
  // TEMPORARY: Maintenance mode forced ON during voiceover tool fix (user 2026-10-13).
  // Revert to KV check when fix is complete.
  const enabled = true; // await getKV<boolean>(KEY, false);
  return NextResponse.json(
    { enabled: !!enabled },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
