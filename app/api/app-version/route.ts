import { NextResponse } from "next/server";

// Current OmniBox Android app release. The in-app updater (MainActivity)
// polls this endpoint on startup; if versionCode is higher than the
// installed app's, it shows an "Update available" popup.
const LATEST = {
  versionCode: 8,
  versionName: "8",
  apkUrl: "https://omnitoolbox-zeta.vercel.app/downloads/omnibox-app.apk",
  changelog:
    "• Fresh v8 — all latest website styles & fixes!\n" +
    "• New gradient nav bar & Higgsfield-style buttons\n" +
    "• A-to-Z smart search\n" +
    "• Cache auto-clear — latest content always",
};

export async function GET() {
  return NextResponse.json(LATEST, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
