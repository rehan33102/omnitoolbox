import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "OmniToolBox",
    description: SITE_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#08080f",
    theme_color: "#7c3aed",
    icons: [{ src: "/icon", sizes: "64x64", type: "image/png" }],
  };
}
