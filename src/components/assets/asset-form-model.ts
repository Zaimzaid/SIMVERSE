import type { AssetView } from "@/server/services/asset-service";
import type { AssetStatus, AssetType } from "@/lib/assets/constants";

export interface AssetFormInitial {
  id: string; name: string; description: string; type: AssetType;
  status: Exclude<AssetStatus, "ARCHIVED">; tags: string[];
  provenance: AssetView["version"]["provenance"];
  licenseInfo?: AssetView["version"]["licenseInfo"];
  authorInfo?: AssetView["version"]["authorInfo"];
  externalReference: string; thumbnailReference: string; technicalMetadata: string;
  modelSpecification?: AssetView["version"]["modelSpecification"];
  rigSpecification?: AssetView["version"]["rigSpecification"];
  animationSpecification?: AssetView["version"]["animationSpecification"];
  productionChecklist: AssetView["version"]["productionChecklist"];
  entityIds: string[]; parentAssetIds: string[];
}

export function assetToFormInitial(asset: AssetView): AssetFormInitial {
  const status = asset.status === "ARCHIVED"
    ? (asset.archivedFromStatus && asset.archivedFromStatus !== "ARCHIVED" ? asset.archivedFromStatus : "DRAFT")
    : asset.status;
  return {
    id: asset.id, name: asset.name, description: asset.description ?? "", type: asset.type,
    status, tags: asset.version.tags, provenance: asset.version.provenance,
    licenseInfo: asset.version.licenseInfo, authorInfo: asset.version.authorInfo,
    externalReference: asset.version.externalReference ?? "",
    thumbnailReference: asset.version.thumbnailReference ?? "",
    technicalMetadata: JSON.stringify(asset.version.technicalMetadata, null, 2),
    modelSpecification: asset.version.modelSpecification,
    rigSpecification: asset.version.rigSpecification,
    animationSpecification: asset.version.animationSpecification,
    productionChecklist: asset.version.productionChecklist,
    entityIds: asset.entities.map((entity) => entity.entityId),
    parentAssetIds: asset.parents.map((parent) => parent.id),
  };
}
