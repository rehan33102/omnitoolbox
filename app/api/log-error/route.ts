import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Client-side error logging endpoint.
 * Receives JS exceptions / API failures from the browser and logs them
 * server-side (Vercel function logs). Rate-limited client-side by the
 * reporter's dedupe; kept lightweight on purpose.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { message, stack, url, component, extra } = body ?? {};

    // Structured server log — visible in Vercel function logs.
    console.error("[client-error]", {
      at: new Date().toISOString(),
      url: typeof url === "string" ? url.slice(0, 300) : undefined,
      component: typeof component === "string" ? component.slice(0, 100) : undefined,
      message: typeof message === "string" ? message.slice(0, 500) : "unknown",
      stack: typeof stack === "string" ? stack.slice(0, 2000) : undefined,
      extra: extra ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
