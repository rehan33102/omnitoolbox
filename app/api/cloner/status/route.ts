import { NextResponse } from "next/server";
import { clonerFetch, ClonerOffline } from "@/lib/cloner";

/**
 * GET /api/cloner/status — lets the tool page show an honest offline banner
 * before the visitor uploads anything. Never throws: { online: boolean }.
 */
export async function GET() {
  try {
    const res = await clonerFetch("/health");
    const ok = res.ok;
    try {
      await res.arrayBuffer();
    } catch {
      /* drain ignored */
    }
    return NextResponse.json({ online: ok });
  } catch (err) {
    if (err instanceof ClonerOffline) {
      return NextResponse.json({ online: false });
    }
    return NextResponse.json({ online: false });
  }
}
