/**
 * lib/ad-schema.ts — zod schema factory + stored SiteAd shape for popup ads.
 * Imported by the admin site-ads API (CRUD) and the public /api/ads/active
 * feed so both can never disagree on validation or option sets.
 */
import { z } from "zod";
import {
  AD_ANIMATIONS,
  AD_FREQUENCIES,
  AD_POSITIONS,
  AD_BACKDROPS,
  AD_DEVICES,
  type AdAnimation,
  type AdFrequency,
  type AdPosition,
  type AdBackdrop,
  type AdDevices,
} from "./ad-options";

export type { AdAnimation, AdFrequency, AdPosition, AdBackdrop, AdDevices };

/** Stored shape. New per-ad options are optional so ads saved before they
 * existed still read/validate; every consumer applies AD_DEFAULTS via `??`. */
export interface SiteAd {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  animation: AdAnimation;
  durationSec: number;
  pages: string[];
  enabled: boolean;
  createdAt: string;
  showDelaySec?: number;
  frequency?: AdFrequency;
  position?: AdPosition;
  backdrop?: AdBackdrop;
  closeDelaySec?: number;
  devices?: AdDevices;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
}

const httpUrl = z
  .string()
  .min(1, "Required")
  .refine((s) => /^https?:\/\/.+/.test(s), { message: "Must be an http(s) URL" });

const imageUrlSchema = z
  .string()
  .min(1, "Required")
  .max(2 * 1024 * 1024, "Image too large (max ~2MB)")
  .refine(
    (s) => /^https?:\/\/.+/.test(s) || /^data:image\/[a-zA-Z+]+;base64,/.test(s),
    { message: "Must be an http(s) URL or an image data URL" }
  );

const isoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid date/time" });

/**
 * Builds the create/patch schemas. `validPaths` is injected by the admin
 * route (which owns PAGE_TARGETS) so this module stays free of page-list
 * imports.
 */
export function makeAdSchemas(validPaths: Set<string>) {
  const adObject = z.object({
    name: z.string().min(1, "Name required").max(80),
    imageUrl: imageUrlSchema,
    linkUrl: httpUrl,
    animation: z.enum(AD_ANIMATIONS),
    durationSec: z.number().int().min(5).max(600),
    pages: z
      .array(z.string())
      .refine((arr) => arr.every((p) => validPaths.has(p)), {
        message: "Invalid page target",
      }),
    enabled: z.boolean(),
    // --- per-ad options (optional w/ defaults → old ads keep working) ---
    showDelaySec: z.number().int().min(0).max(300).optional().default(0),
    frequency: z.enum(AD_FREQUENCIES).optional().default("session"),
    position: z.enum(AD_POSITIONS).optional().default("center"),
    backdrop: z.enum(AD_BACKDROPS).optional().default("dim"),
    closeDelaySec: z.number().int().min(0).max(120).optional().default(0),
    devices: z.enum(AD_DEVICES).optional().default("all"),
    scheduleStart: isoDateTime.optional().nullable(),
    scheduleEnd: isoDateTime.optional().nullable(),
  });

  const refineScheduleWindow = (
    v: { scheduleStart?: string | null; scheduleEnd?: string | null },
    ctx: z.RefinementCtx
  ) => {
    if (
      v.scheduleStart &&
      v.scheduleEnd &&
      Date.parse(v.scheduleEnd) <= Date.parse(v.scheduleStart)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduleEnd"],
        message: "End must be after start",
      });
    }
  };

  // .superRefine returns ZodEffects (no .partial()), so derive the patch
  // schema from the base object first, then refine each.
  const adSchema = adObject.superRefine(refineScheduleWindow);
  const patchSchema = adObject
    .partial()
    .extend({ id: z.string().min(1) })
    .superRefine(refineScheduleWindow);
  return { adSchema, patchSchema };
}
