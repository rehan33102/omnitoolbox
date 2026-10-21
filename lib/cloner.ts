/**
 * lib/cloner.ts — server-side client for the voice-cloning backend.
 *
 * SERVER-ONLY: never import into client components. Holds the dedicated
 * website-proxy account credentials (env) and the session cookie (memory).
 * The backend URL itself is never exposed to the browser — all browser
 * traffic goes through the /api/cloner/* proxy routes.
 *
 * Backend base URL: KV key `cloner_api_url` (stored as a JSON string, e.g.
 * `"https://abc-123.trycloudflare.com"`), env fallback `CLONER_API_URL`.
 * Login: POST /api/login with CLONER_USERNAME / CLONER_PASSWORD.
 */
import { getKV } from "@/lib/kv";

export class ClonerOffline extends Error {
  constructor(message = "The voice cloner backend is not reachable.") {
    super(message);
    this.name = "ClonerOffline";
  }
}

/** Cached session cookies from POST /api/login (module memory). */
let sessionCookies: string[] = [];

interface ClonerConfig {
  url?: string;
  username?: string;
  password?: string;
}

/**
 * Full backend config from KV key `cloner_config`
 * ({url, username, password}) — the tunnel supervisor keeps the URL current
 * there because the free tunnel address rotates. Env vars stay as a static
 * fallback (CLONER_API_URL / CLONER_USERNAME / CLONER_PASSWORD), and the
 * legacy KV string `cloner_api_url` still works for the URL.
 */
async function getClonerConfig(): Promise<ClonerConfig> {
  const cfg = await getKV<ClonerConfig>("cloner_config", {});
  return typeof cfg === "object" && cfg !== null ? cfg : {};
}

/**
 * Public endpoint channel: the backend's tunnel supervisor publishes the
 * current backend URL as JSON on a dedicated branch of the site repo
 * (the free tunnel address rotates roughly hourly). Read via the raw CDN
 * URL, cached in module memory for a minute; `invalidateEndpointCache`
 * forces a fresh read after a network failure.
 */
const ENDPOINT_JSON_URLS = [
  "https://raw.githubusercontent.com/rehan33102/omnitoolbox/cloner-endpoint/endpoint.json",
  // Independent mirror of the same file — the two CDNs go stale at
  // different times when the tunnel URL rotates, so checking both (and
  // probing on disagreement) closes most of the "offline" gap.
  "https://cdn.jsdelivr.net/gh/rehan33102/omnitoolbox@cloner-endpoint/endpoint.json",
];
let endpointCache: { url: string; at: number } | null = null;

export function invalidateEndpointCache(): void {
  endpointCache = null;
}

async function readEndpointMirror(mirror: string): Promise<string> {
  try {
    const res = await fetch(mirror, { cache: "no-store" });
    if (!res.ok) return "";
    const data = (await res.json()) as { url?: unknown };
    return typeof data?.url === "string" ? data.url.trim() : "";
  } catch {
    return "";
  }
}

async function probeAlive(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`${url.replace(/\/+$/, "")}/health`, {
      cache: "no-store",
      signal: ctl.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchEndpointUrl(): Promise<string> {
  if (endpointCache && Date.now() - endpointCache.at < 60_000) {
    return endpointCache.url;
  }
  const found = await Promise.all(ENDPOINT_JSON_URLS.map(readEndpointMirror));
  const candidates = [...new Set(found.filter(Boolean))];
  if (candidates.length === 0) return endpointCache?.url || "";
  let winner = candidates[0];
  if (candidates.length > 1) {
    // Mirrors disagree (a rotation is propagating): keep the URL that is
    // actually alive right now.
    for (const c of candidates) {
      if (await probeAlive(c)) {
        winner = c;
        break;
      }
    }
  }
  endpointCache = { url: winner, at: Date.now() };
  return winner;
}

/** Backend base URL without trailing slash, or "" when not configured. */
export async function getClonerBaseUrl(): Promise<string> {
  const cfg = await getClonerConfig();
  let raw = (cfg.url || "").trim();
  if (!raw) {
    const fromKv = await getKV<string>("cloner_api_url", "");
    raw = (fromKv || process.env.CLONER_API_URL || "").trim();
  }
  if (!raw) raw = await fetchEndpointUrl();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

async function getCredentials(): Promise<{ username: string; password: string }> {
  const cfg = await getClonerConfig();
  return {
    username: (cfg.username || process.env.CLONER_USERNAME || "").trim(),
    password: cfg.password || process.env.CLONER_PASSWORD || "",
  };
}

/** Log in to the cloner backend and refresh the cached session cookie. */
async function login(base: string): Promise<void> {
  const { username, password } = await getCredentials();
  if (!username || !password) {
    throw new ClonerOffline("Voice cloner credentials are not configured.");
  }
  let res: Response;
  try {
    res = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    // Backend unreachable (tunnel down, DNS/connection failure) — not a
    // credential problem — so the honest offline path handles it.
    throw new ClonerOffline("Voice cloner login failed.");
  }
  if (!res.ok) {
    throw new ClonerOffline("Voice cloner login failed.");
  }
  const getSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [];
  if (cookies.length > 0) sessionCookies = cookies;
}

/**
 * Fetch through to the cloner backend with the session cookie.
 * Throws ClonerOffline when the backend is missing/unreachable (never fakes data).
 * Re-logs-in once on a 401 before giving up.
 */
export async function clonerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const attempt = async (base: string): Promise<Response> => {
    const doFetch = async (): Promise<Response> => {
      const headers = new Headers(init.headers);
      if (sessionCookies.length > 0) headers.set("cookie", sessionCookies.join("; "));
      let res: Response;
      try {
        res = await fetch(`${base}${path}`, { ...init, headers });
      } catch {
        throw new ClonerOffline();
      }
      return res;
    };

    if (sessionCookies.length === 0) await login(base);
    let res = await doFetch();
    if (res.status === 401) {
      sessionCookies = [];
      await login(base);
      res = await doFetch();
    }
    // Gateway statuses mean the backend/tunnel is down or restarting — not a
    // real engine error — so surface them as ClonerOffline. This lets every
    // /api/cloner/* route return 503 { error:"cloner_offline" } (never a fake
    // result) and gives the client its calm retry + honest offline UX instead
    // of a hard 502 failure.
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new ClonerOffline(`Voice backend returned ${res.status}.`);
    }
    return res;
  };

  const base = await getClonerBaseUrl();
  if (!base) throw new ClonerOffline("Voice cloner is not configured yet.");
  try {
    return await attempt(base);
  } catch (err) {
    // The published endpoint may have rotated since it was cached — refresh
    // it once and retry when it now points somewhere else.
    invalidateEndpointCache();
    const fresh = await getClonerBaseUrl();
    if (fresh && fresh !== base) return attempt(fresh);
    throw err;
  }
}

/** Read a backend response as JSON (tolerates non-JSON error pages). */
export async function readBackendJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const data = await res.json();
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
