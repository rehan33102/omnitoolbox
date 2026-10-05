import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Current OmniBox Android app release. The in-app updater (MainActivity)
// polls this endpoint on startup; if versionCode is higher than the
// installed app's, it shows an "Update available" popup.
const LATEST = {
  versionCode: 11,
  versionName: "11",
  apkUrl: "https://omnitoolbox-zeta.vercel.app/downloads/omnibox-app.apk",
  changelog:
    "• v11 — AUTO-UPDATE! 🔄\n" +
    "• The app now downloads updates automatically\n" +
    "• No buttons to press — everything is automatic!",
};

export async function GET() {
  return NextResponse.json(LATEST, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
