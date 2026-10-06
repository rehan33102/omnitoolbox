/**
 * lib/ad-options.ts — canonical popup-ad option sets shared by the admin
 * site-ads API (zod), the public /api/ads/active feed, the AdPopup client
 * component, and the admin monetization form.
 *
 * Keep the value arrays as the single source of truth; labels live here too
 * so the admin dropdowns can't drift from what the API accepts.
 */

export const AD_ANIMATIONS = [
  "fade",
  "slide-up",
  "slide-down",
  "slide-in-right",
  "slide-in-left",
  "zoom",
  "bounce",
  "flip-in",
  "rotate-in",
  "pop",
  "elastic",
] as const;
export type AdAnimation = (typeof AD_ANIMATIONS)[number];

export const AD_ANIMATION_LABELS: Record<AdAnimation, string> = {
  fade: "Fade",
  "slide-up": "Slide up",
  "slide-down": "Slide down",
  "slide-in-right": "Slide in right",
  "slide-in-left": "Slide in left",
  zoom: "Zoom",
  bounce: "Bounce",
  "flip-in": "Flip in",
  "rotate-in": "Rotate in",
  pop: "Pop",
  elastic: "Elastic",
};

export const AD_FREQUENCIES = ["session", "page", "day"] as const;
export type AdFrequency = (typeof AD_FREQUENCIES)[number];

export const AD_FREQUENCY_LABELS: Record<AdFrequency, string> = {
  session: "Once per session",
  page: "Every page view",
  day: "Once per day",
};

export const AD_POSITIONS = ["center", "bottom-right", "bottom-left"] as const;
export type AdPosition = (typeof AD_POSITIONS)[number];

export const AD_POSITION_LABELS: Record<AdPosition, string> = {
  center: "Center modal",
  "bottom-right": "Bottom right card",
  "bottom-left": "Bottom left card",
};

export const AD_BACKDROPS = ["dim", "blur", "none"] as const;
export type AdBackdrop = (typeof AD_BACKDROPS)[number];

export const AD_BACKDROP_LABELS: Record<AdBackdrop, string> = {
  dim: "Dim",
  blur: "Blur",
  none: "None",
};

export const AD_DEVICES = ["all", "mobile", "desktop"] as const;
export type AdDevices = (typeof AD_DEVICES)[number];

export const AD_DEVICE_LABELS: Record<AdDevices, string> = {
  all: "All devices",
  mobile: "Mobile only",
  desktop: "Desktop only",
};

/** Backward-compatible defaults for ads stored before an option existed. */
export const AD_DEFAULTS: {
  showDelaySec: number;
  frequency: AdFrequency;
  position: AdPosition;
  backdrop: AdBackdrop;
  closeDelaySec: number;
  devices: AdDevices;
} = {
  showDelaySec: 0,
  frequency: "session",
  position: "center",
  backdrop: "dim",
  closeDelaySec: 0,
  devices: "all",
};
