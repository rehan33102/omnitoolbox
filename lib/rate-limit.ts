const hits = new Map<string, { count: number; reset: number }>();

/** Tiny in-memory rate limiter. Returns true if the request is allowed. */
export function rateLimit(key: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}
