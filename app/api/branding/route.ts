import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { guardApi } from "@/lib/api-security";
import { setKV } from "@/lib/kv";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

const KV_KEY = "site_branding";

// Public GET must be dynamic: branding is edited live in admin. A static
// prerender would bake build-time defaults forever.
/** @public */
export const dynamic = "force-dynamic";

const urlField = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (v) =>
        v === "" ||
        /^https?:\/\/[^\s]+$/i.test(v) ||
        /^data:image\/[a-zA-Z0-9+]+;base64,/.test(v),
      { message: "must be an http(s) URL or a data:image/ URL" }
    );

const brandingSchema = z.object({
  siteName: z.string().max(80).optional().default(""),
  tagline: z.string().max(300).optional().default(""),
  logoUrl: urlField(2_000_000).optional().default(""),
  faviconUrl: urlField(500_000).optional().default(""),
  accentColor: z
    .string()
    .regex(/^$|^#[0-9a-fA-F]{6}$/, { message: "must be empty or a #rrggbb hex color" })
    .optional()
    .default(""),
  footerText: z.string().max(500).optional().default(""),
  socialX: urlField(500).optional().default(""),
  socialInstagram: urlField(500).optional().default(""),
  socialYoutube: urlField(500).optional().default(""),
  socialTiktok: urlField(500).optional().default(""),
});

export type BrandingPayload = z.infer<typeof brandingSchema>;

const DEFAULT_BRANDING: BrandingPayload = {
  siteName: "",
  tagline: "",
  logoUrl: "",
  faviconUrl: "",
  accentColor: "",
  footerText: "",
  socialX: "",
  socialInstagram: "",
  socialYoutube: "",
  socialTiktok: "",
};

/** Direct DB read for branding — bypasses lib/kv to avoid any bundling staleness. */
async function readBranding(): Promise<BrandingPayload> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("seo_settings")
      .select("value")
      .eq("key", KV_KEY)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = Array.isArray(data) ? data[0] : null;
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_BRANDING, ...parsed };
    }
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_BRANDING };
}

async function guard(req: NextRequest) {
  // 30 req/min per IP + same-origin enforcement before any auth/DB work.
  const sec = guardApi(req, { key: "admin:branding", max: 30 });
  if (sec) return sec;
  const admin = await requirePermission("settings");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** GET — public. Returns the site branding JSON. No cache: branding must be live. */
export async function GET() {
  const branding = await readBranding();
  return NextResponse.json(branding, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

/** PUT — admin only. Validates + persists branding to the KV store. */
export async function PUT(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;

  const parsed = brandingSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const branding: BrandingPayload = {
    siteName: parsed.data.siteName.trim(),
    tagline: parsed.data.tagline.trim(),
    logoUrl: parsed.data.logoUrl.trim(),
    faviconUrl: parsed.data.faviconUrl.trim(),
    accentColor: parsed.data.accentColor.trim().toLowerCase(),
    footerText: parsed.data.footerText.trim(),
    socialX: parsed.data.socialX.trim(),
    socialInstagram: parsed.data.socialInstagram.trim(),
    socialYoutube: parsed.data.socialYoutube.trim(),
    socialTiktok: parsed.data.socialTiktok.trim(),
  };

  const ok = await setKV(KV_KEY, branding);
  if (!ok) return NextResponse.json({ error: "Failed to save branding" }, { status: 500 });

  const admin = await requirePermission("settings");
  await logActivity(
    "branding.updated",
    `Site branding updated${branding.siteName ? ` — name "${branding.siteName}"` : ""}${
      branding.accentColor ? `, accent ${branding.accentColor}` : ""
    }`,
    admin?.email ?? "admin"
  );

  return NextResponse.json({ ok: true, branding });
}
