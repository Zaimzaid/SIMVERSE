import type {
  EarthBoundaryQuality,
  EarthPlaceKind,
  EarthVerificationStatus,
} from "./constants";

export interface EarthDatasetAttribution {
  provider: string;
  releaseType: string;
  version: string;
  sourceRevision: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  attribution: string;
}

export interface EarthPlaceSummary {
  id: string;
  parentId: string | null;
  kind: EarthPlaceKind;
  name: string;
  isoAlpha2: string | null;
  isoAlpha3: string | null;
  adminLevel: number | null;
  geometryType: "Point" | "Polygon" | "MultiPolygon" | "None";
  boundaryQuality: EarthBoundaryQuality;
  verificationStatus: EarthVerificationStatus;
  coordinateReferenceSystem: string;
  bbox: [number, number, number, number] | null;
  label: [number, number] | null;
  contentHash: string;
  dataset: EarthDatasetAttribution;
}

export interface EarthPlaceDetail extends EarthPlaceSummary {
  hierarchy: EarthPlaceSummary[];
  childCount: number;
  hasBoundary: boolean;
}

export interface EarthBoundaryView {
  type: "Feature";
  id: string;
  properties: {
    name: string;
    kind: EarthPlaceKind;
    boundaryQuality: EarthBoundaryQuality;
    verificationStatus: EarthVerificationStatus;
    coordinateReferenceSystem: string;
    contentHash: string;
    datasetVersion: string;
    attribution: string;
  };
  geometry: {
    type: "Point" | "Polygon" | "MultiPolygon";
    coordinates: unknown;
  } | null;
}
