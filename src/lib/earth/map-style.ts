import type { StyleSpecification } from "maplibre-gl";
import type { PublicEarthOverview } from "./public";

/**
 * Local, key-free globe style. Natural Earth land arrives through bounded MVT
 * requests; catalog detail remains a separate protected source.
 */
export function createEarthOverviewStyle(
  overview: Pick<PublicEarthOverview,
    "tileTemplate" | "minZoom" | "maxZoom" | "attribution">,
): StyleSpecification {
  return {
    version: 8,
    sources: {
      "earth-overview": {
        type: "vector",
        tiles: [overview.tileTemplate],
        minzoom: overview.minZoom,
        maxzoom: overview.maxZoom,
        attribution: overview.attribution,
      },
    },
    layers: [
      {
        id: "earth-ocean",
        type: "background",
        paint: { "background-color": "#03101f" },
      },
      {
        id: "earth-land-shadow",
        type: "fill",
        source: "earth-overview",
        "source-layer": "land",
        paint: {
          "fill-color": "#0a2638",
          "fill-opacity": 1,
          "fill-outline-color": "#123e52",
        },
      },
      {
        id: "earth-coastline",
        type: "line",
        source: "earth-overview",
        "source-layer": "land",
        paint: {
          "line-color": "#3ba8b8",
          "line-opacity": 0.72,
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 4, 1.4],
        },
      },
    ],
  };
}

export const EMPTY_FEATURE_COLLECTION = {
  type: "FeatureCollection",
  features: [],
} as const;
