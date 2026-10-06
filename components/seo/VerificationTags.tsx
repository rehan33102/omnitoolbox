import { getKV } from "@/lib/kv";

/**
 * Server component — renders search-engine verification <meta> tags.
 * Reads KV `seo_verification` { google, bing } set from /admin/seo.
 * Mounted inside <head> in the root layout; renders nothing when unset.
 */
export default async function VerificationTags() {
  let v: { google?: string; bing?: string } = {};
  try {
    v = await getKV<{ google?: string; bing?: string }>("seo_verification", {});
  } catch {
    /* DB unreachable — render nothing */
  }
  const google = v.google?.trim();
  const bing = v.bing?.trim();
  if (!google && !bing) return null;
  return (
    <>
      {google ? <meta name="google-site-verification" content={google} /> : null}
      {bing ? <meta name="msvalidate.01" content={bing} /> : null}
    </>
  );
}
