import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Current OmniBox Android app release.
// NOTE: The in-app update popup has been REMOVED from both apps (v12+).
// This endpoint is kept for reference only — apps no longer poll it.
const LATEST = {
  versionCode: 12,
  versionName: "12",
  apkUrl: "https://omnitoolbox-zeta.vercel.app/downloads/omnibox-app.apk",
  changelog: "Update popup removed — the app loads the live website automatically.",
};

export async function GET() {
  return NextResponse.json(LATEST, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
