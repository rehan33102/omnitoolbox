import { createClient } from "@supabase/supabase-js";

/** Service-role client. NEVER import into client components. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Critical: Next.js patches global fetch() to cache by default, and
      // supabase-js uses fetch() internally. Without cache:'no-store', DB
      // queries get served from Next's Data Cache → stale reads (this was
      // the "deleted ad still shows / branding won't update" bug).
      global: {
        fetch: (url, options) =>
          fetch(url, { ...options, cache: "no-store" as RequestCache }),
      },
    }
  );
}
