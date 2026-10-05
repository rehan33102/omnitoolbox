import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

// Returns the current deployed version (git commit hash).
// The AutoUpdater client polls this; when the hash changes, the page auto-reloads
// so users always get the latest version without doing anything.
export async function GET() {
  let version = "unknown";
  try {
    version = execSync("git rev-parse --short HEAD", { timeout: 5000 })
      .toString()
      .trim();
  } catch {
    // Vercel provides this env var at build/runtime
    version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown";
  }
  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
