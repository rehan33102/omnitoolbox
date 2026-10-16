import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public: is maintenance mode on? */
export async function GET() {
  // TEMP: maintenance banner ON during the Ebook Maker deploy (2026-10-16).
  // Will be flipped back to false once the deploy is verified live.
  const enabled = true;
  return NextResponse.json(
    { enabled: !!enabled },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
