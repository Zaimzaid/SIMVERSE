import type { MetadataRoute } from "next";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_DESCRIPTION } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND_NAME + " — " + BRAND_TAGLINE,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070a12",
    theme_color: "#07152e",
    icons: [{ src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" }],
  };
}
