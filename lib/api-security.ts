import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";

/**
 * Shared API security primitives (Part 3.3 hardening).
 *
 * - getClientIp: best-effort client IP for rate-limit keys.
 * - rateLimitOr429: returns a 429 JSON response when the bucket is
 *   exhausted, otherwise null (request may proceed).
 * - originForbidden: returns a 403 JSON response when a cross-origin
 *   request targets a state-changing endpoint and the Origin is not
 *   the site itself or in ALLOWED_ORIGINS. Returns null when allowed.
 *   Requests without an Origin header (curl, native apps, server-to-
 *   server) are allowed through — they cannot be CSRF'd by a browser.
 * - preflightResponse: 204 response for CORS OPTIONS preflights.
 */

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function rateLimitOr429(
  req: NextRequest,
  key: string,
  max = 60,
  windowMs = 60_000
): NextResponse | null {
  const ip = getClientIp(req);
  if (!rateLimit(`${key}:${ip}`, max, windowMs)) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  return null;
}

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function originForbidden(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // non-browser client — nothing to CSRF-protect
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const reqHost = req.headers.get("host")?.toLowerCase() ?? "";
  if (originHost === reqHost) return null; // same-origin
  if (allowedOrigins().includes(origin.toLowerCase()) || allowedOrigins().includes(originHost)) {
    return null;
  }
  return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
}

export function preflightResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * One-call guard for API routes: origin check + rate limit.
 * Returns a response to send immediately, or null to continue.
 */
export function guardApi(
  req: NextRequest,
  opts: { key: string; max?: number; windowMs?: number; skipOriginCheck?: boolean } = { key: "api" }
): NextResponse | null {
  if (!opts.skipOriginCheck && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const blocked = originForbidden(req);
    if (blocked) return blocked;
  }
  return rateLimitOr429(req, opts.key, opts.max ?? 60, opts.windowMs ?? 60_000);
}
