import { NextResponse } from "next/server";

// Current OmniBox Android app release. The in-app updater (MainActivity)
// polls this endpoint on startup; if versionCode is higher than the
// installed app's, it shows an "Update available" popup.
const LATEST = {
  versionCode: 7,
  versionName: "7",
  apkUrl: "https://omnitoolbox-zeta.vercel.app/downloads/omnibox-app.apk",
  changelog:
    "• Cache auto-clear — website updates appear instantly!\n" +
    "• Fixed old content showing issue\n" +
    "• All previous fixes included",
};

export async function GET() {
  return NextResponse.json(LATEST, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
