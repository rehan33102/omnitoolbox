import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// Free keyless background-removal API (Cloudflare Images under the hood).
// Quotas: 5 req/min, 20/day per IP. Our client-side AI is the fallback.
const NOBG_URL = "https://api.nobg.akshit.io/api/v1/remove-background";

export async function POST(req: NextRequest) {
  // Rate limit: 10/min per IP (protects shared upstream quota)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`bgremove:${ip}`, 10)) {
    return NextResponse.json({ error: "server_busy" }, { status: 429 });
  }

  let image: Blob | null = null;
  try {
    const form = await req.formData();
    const f = form.get("image");
    if (f instanceof Blob) image = f;
  } catch {
    /* fall through */
  }
  if (!image) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (max 10MB)." }, { status: 400 });
  }

  try {
    const upstream = new FormData();
    upstream.append("image", image, "image.png");
    const res = await fetch(NOBG_URL, {
      method: "POST",
      body: upstream,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      // Tell the client to fall back to on-device AI.
      return NextResponse.json({ error: "server_busy" }, { status: 502 });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) {
      return NextResponse.json({ error: "server_busy" }, { status: 502 });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "server_busy" }, { status: 502 });
  }
}
