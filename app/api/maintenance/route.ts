import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public: is maintenance mode on? */
export async function GET() {
  // Maintenance work is done — banner forced OFF site-wide.
  // The admin toggle (/api/admin/maintenance, KV key "maintenance_mode")
  // remains the source of truth; this override keeps visitors banner-free
  // until the KV flag is fixed in the database.
  const enabled = false;
  return NextResponse.json(
    { enabled: !!enabled },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
