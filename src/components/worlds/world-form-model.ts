import type { WorldView } from "@/server/services/world-service";
import type { WorldStatus, WorldVisibility } from "@/lib/worlds/constants";
import type { WorldAssetAssociation, WorldBlueprintV1, WorldEntityAssociation } from "@/lib/worlds/schemas";

export interface WorldFormInitial {
  id: string; name: string; description: string; category: string;
  status: Exclude<WorldStatus, "ARCHIVED">; tags: string[]; biome: WorldView["biome"];
  customBiome: string; thumbnailReference: string; visibility: WorldVisibility;
  blueprint: WorldBlueprintV1; assetAssociations: WorldAssetAssociation[];
  entityAssociations: WorldEntityAssociation[];
}

export function worldToFormInitial(world: WorldView): WorldFormInitial {
  const status = world.status === "ARCHIVED"
    ? (world.archivedFromStatus && world.archivedFromStatus !== "ARCHIVED" ? world.archivedFromStatus : "DRAFT")
    : world.status;
  return {
    id: world.id, name: world.name, description: world.description ?? "", category: world.category,
    status, tags: world.version.tags, biome: world.biome, customBiome: world.version.customBiome ?? "",
    thumbnailReference: world.thumbnailReference ?? "", visibility: world.visibility,
    blueprint: world.version.blueprint, assetAssociations: world.version.assetAssociations,
    entityAssociations: world.version.entityAssociations,
  };
}
