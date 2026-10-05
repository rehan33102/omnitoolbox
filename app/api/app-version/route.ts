import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Current OmniBox Android app release. The in-app updater (MainActivity)
// polls this endpoint on startup; if versionCode is higher than the
// installed app's, it shows an "Update available" popup.
const LATEST = {
  versionCode: 10,
  versionName: "10",
  apkUrl: "https://omnitoolbox-zeta.vercel.app/downloads/omnibox-app.apk",
  changelog:
    "• v10 — DOWNLOADS FIXED! 📥\n" +
    "• Downloads ab app mein kaam karte hain\n" +
    "• Library ab delete nahi hoti\n" +
    "• Videos dubara download nahi hote\n" +
    "• Sab bugs fixed",
};

export async function GET() {
  return NextResponse.json(LATEST, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
