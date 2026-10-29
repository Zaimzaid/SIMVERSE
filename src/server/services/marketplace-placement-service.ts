import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { isMarketModelReference } from "@/lib/marketplace/model-ref";
import { DEFAULT_VISUAL_PROFILE, type VisualArchetype } from "@/lib/visuals/profile";
import { prisma } from "@/server/db/client";
import { requireMembership } from "@/server/services/workspace-service";
import { getEntity, upsertEntityVisualProfile } from "@/server/services/entity-service";
import { getWorld, updateWorld } from "@/server/services/world-service";
import { importEntitledAsset } from "@/server/services/marketplace-service";
import { getAsset } from "@/server/services/asset-service";

const geometryTypes = new Set(["MODEL_3D","CREATURE","CHARACTER","PROP","VEHICLE","ENVIRONMENT"]);

async function licensedModel(userId:string,workspaceId:string,entitlementId:string){
  const entitlement=await prisma.marketEntitlement.findFirst({
    where:{id:entitlementId,userId,status:"ACTIVE"},
  });
  if(!entitlement)throw new NotFoundError("You do not have an active license for this item.");
  const original=await prisma.assetVersion.findFirst({
    where:{assetId:entitlement.assetId,version:entitlement.assetVersion},
    select:{type:true,externalReference:true},
  });
  if(!original || !geometryTypes.has(original.type) || !isMarketModelReference(original.externalReference))
    throw new ValidationError("This item is not a supported GLB model.");
  // Original source is never automatically transferred to another workspace.
  const imported=await importEntitledAsset(userId,workspaceId,entitlement.id);
  const current=await getAsset(userId,workspaceId,imported.id);
  if(current.status==="ARCHIVED")throw new ConflictError("Restore the imported asset first.");
  return {entitlement,original,imported:current};
}

function archetype(type:string):VisualArchetype {
  switch(type){
    case "CREATURE": return "QUADRUPED";
    case "CHARACTER": return "HUMANOID";
    case "VEHICLE": return "VEHICLE_GROUND";
    default: return "OBJECT";
  }
}

/** Replace the selected Entity's model appearance, not its behavior or stats. */
export async function useMarketplaceModelInEntity(
  userId:string,workspaceId:string,entitlementId:string,entityId:string,
){
  await requireMembership(userId,workspaceId,"entity.edit");
  const entity=await getEntity(userId,workspaceId,entityId);
  if(entity.status==="ARCHIVED")throw new ConflictError("Archived Entities cannot be edited.");
  const {original,imported}=await licensedModel(userId,workspaceId,entitlementId);
  const url=original.externalReference!;
  if(entity.visualProfile?.sourceType==="MODEL_3D" && entity.visualProfile.modelUrl===url)
    return {entityId,assetId:imported.id,updated:false};
  await upsertEntityVisualProfile(userId,workspaceId,entityId,{
    ...DEFAULT_VISUAL_PROFILE,
    sourceType:"MODEL_3D",
    modelUrl:url,
    archetype:archetype(original.type),
    portraitUrl:entity.visualProfile?.portraitUrl??entity.imageUrl??undefined,
  });
  return {entityId,assetId:imported.id,updated:true};
}

/**
 * Attach a licensed asset as a version-pinned World definition reference.
 * Placement, geometry rendering and experience compatibility are NOT implied.
 */
export async function attachMarketplaceAssetToWorld(
  userId:string,workspaceId:string,entitlementId:string,worldId:string,
){
  await requireMembership(userId,workspaceId,"world.manage");
  const world=await getWorld(userId,workspaceId,worldId);
  if(world.status==="ARCHIVED")throw new ConflictError("Archived worlds cannot be edited.");
  const {entitlement,original,imported}=await licensedModel(userId,workspaceId,entitlementId);
  const identifier="market_"+entitlement.id.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,60);
  const exists=world.version.assetAssociations.find(a=>a.identifier===identifier);
  if(exists){
    if(exists.assetId!==imported.id)throw new ConflictError("This marketplace placement identifier is in use.");
    return {worldId,assetId:imported.id,updated:false};
  }
  if(world.version.assetAssociations.length>=500)throw new ConflictError("This world has reached its asset limit.");
  const association={
    identifier,assetId:imported.id,assetVersion:imported.currentVersion,
    role: original.type==="ENVIRONMENT" ? "ENVIRONMENT" as const : "PROP" as const,
    configuration:{marketplaceEntitlementId:entitlement.id,licensed:true},
  };
  await updateWorld(userId,workspaceId,worldId,{
    assetAssociations:[...world.version.assetAssociations,association],
    changeNote:"Added a licensed marketplace model reference",
  });
  return {worldId,assetId:imported.id,updated:true};
}
