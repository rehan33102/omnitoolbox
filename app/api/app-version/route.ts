import { NextResponse } from "next/server";

// Current OmniBox Android app release. The in-app updater (MainActivity)
// polls this endpoint on startup; if versionCode is higher than the
// installed app's, it shows an "Update available" popup.
const LATEST = {
  versionCode: 6,
  versionName: "6",
  apkUrl: "https://omnitoolbox-zeta.vercel.app/downloads/omnibox-app.apk",
  changelog:
    "• Crash-proof launch (no more instant crashes)\n" +
    "• Fixed header hiding under the status bar\n" +
    "• Update notifications inside the app\n" +
    "• All website features keep updating automatically!",
};

export async function GET() {
  return NextResponse.json(LATEST, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
