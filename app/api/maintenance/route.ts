import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public: is maintenance mode on? */
export async function GET() {
  // Maintenance in progress — banner forced ON site-wide during deploy.
  const enabled = true;
  return NextResponse.json(
    { enabled: !!enabled },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
