import { NextResponse } from "next/server";

// Current OmniBox Android app release. The in-app updater (MainActivity)
// polls this endpoint on startup; if versionCode is higher than the
// installed app's, it shows an "Update available" popup.
const LATEST = {
  versionCode: 9,
  versionName: "9",
  apkUrl: "https://omnitoolbox-zeta.vercel.app/downloads/omnibox-app.apk",
  changelog:
    "• v9 FINAL — sab tests pass!\n" +
    "• Naya admin panel (/admin/auth)\n" +
    "• Sab tools verified working\n" +
    "• Latest styles & fixes",
};

export async function GET() {
  return NextResponse.json(LATEST, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
