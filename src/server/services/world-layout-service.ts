import { z } from "zod";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { isMarketModelReference } from "@/lib/marketplace/model-ref";
import { worldAssetAssociationSchema } from "@/lib/worlds/schemas";
import { prisma } from "@/server/db/client";
import { requireMembership } from "@/server/services/workspace-service";
import { getWorld, updateWorld } from "@/server/services/world-service";
import { parseOrThrow } from "@/lib/validation";

/** A layout entry never includes private source metadata unless the caller may load it. */
export interface WorldLayoutItem {
  identifier: string;
  name: string;
  role: string;
  assetId: string;
  assetVersion: number;
  modelUrl: string | null;
  placement: NonNullable<z.infer<typeof worldAssetAssociationSchema>["placement"]>;
}

const placementSchema = worldAssetAssociationSchema.shape.placement.unwrap();
const placementChangeSchema = z.object({
  identifier: z.string().trim().min(1).max(80),
  placement: placementSchema,
}).strict();
const saveSchema = z.object({
  expectedVersion: z.number().int().positive(),
  placements: z.array(placementChangeSchema).max(500),
}).strict();

function sourceProvenance(row:string):string {
  try { return String((JSON.parse(row) as {kind?:unknown}).kind ?? ""); }
  catch { return ""; }
}

/** Buyer entitlement for this specific imported reference, not mere workspace membership. */
async function canUseImportedAsset(userId:string,workspaceId:string,assetId:string) {
  const imports = await prisma.marketImport.findMany({
    where:{workspaceId,importedAssetId:assetId,status:"COMPLETE"},
    select:{entitlementId:true},
  });
  if (!imports.length) return false;
  const active = await prisma.marketEntitlement.count({where:{
    id:{in:imports.map(item=>item.entitlementId)},userId,status:"ACTIVE",
  }});
  return active>0;
}

/** Viewer data is workspace-scoped and never returns URLs to unlicensed imports. */
export async function loadWorldLayout(userId:string,workspaceId:string,worldId:string) {
  await requireMembership(userId,workspaceId,"world.view");
  const world=await getWorld(userId,workspaceId,worldId);
  const associations=world.version.assetAssociations;
  const versions=await prisma.assetVersion.findMany({where:{
    OR:associations.map(a=>({assetId:a.assetId,version:a.assetVersion})),
    asset:{workspaceId},
  },select:{assetId:true,version:true,externalReference:true,provenance:true,name:true}});
  const byKey=new Map(versions.map(v=>[v.assetId+":"+v.version,v]));
  const items:WorldLayoutItem[]=[];
  for(const a of associations){
    const v=byKey.get(a.assetId+":"+a.assetVersion);
    let modelUrl:string|null=null;
    if(v && isMarketModelReference(v.externalReference)){
      const provenance=sourceProvenance(v.provenance);
      const licensed=provenance==="LICENSED"
        ? await canUseImportedAsset(userId,workspaceId,v.assetId)
        : provenance==="ORIGINAL";
      if(licensed) modelUrl=v.externalReference;
    }
    items.push({
      identifier:a.identifier,assetId:a.assetId,assetVersion:a.assetVersion,
      name:v?.name??world.assets.find(x=>x.identifier===a.identifier)?.assetName??"Asset",
      role:a.role,modelUrl,
      placement:a.placement??{
        position:{x:0,y:0,z:0},
        rotationDegrees:{pitch:0,yaw:0,roll:0},
        scale:{x:1,y:1,z:1},
      },
    });
  }
  return {
    worldId:world.id,worldName:world.name,version:world.currentVersion,status:world.status,
    dimensions:world.version.blueprint.terrain.dimensions,items,
  };
}

/** Changes only placements; all existing World relationships and ownership stay intact. */
export async function saveWorldLayout(userId:string,workspaceId:string,worldId:string,input:unknown) {
  await requireMembership(userId,workspaceId,"world.manage");
  const data=parseOrThrow(saveSchema,input,"Invalid World placement data.");
  const world=await getWorld(userId,workspaceId,worldId);
  if(world.status==="ARCHIVED") throw new ConflictError("Restore the World before editing its layout.");
  if(world.currentVersion!==data.expectedVersion)
    throw new ConflictError("This World changed since you opened the layout. Reload before saving.");
  const associations=world.version.assetAssociations;
  if(data.placements.length!==associations.length)
    throw new ConflictError("The World assets changed. Reload before saving.");
  const requested=new Map(data.placements.map(p=>[p.identifier,p.placement]));
  if(requested.size!==associations.length || associations.some(a=>!requested.has(a.identifier)))
    throw new ConflictError("The World asset list does not match. Reload before saving.");
  // Do not write marketplace-owned assets in a Workspace without a matching user entitlement.
  const versions=await prisma.assetVersion.findMany({where:{
    OR:associations.map(a=>({assetId:a.assetId,version:a.assetVersion})),
    asset:{workspaceId},
  },select:{assetId:true,provenance:true}});
  const uniqueAssets=new Map(versions.map(v=>[v.assetId,sourceProvenance(v.provenance)]));
  for(const [assetId,provenance] of uniqueAssets){
    if(provenance==="LICENSED" && !(await canUseImportedAsset(userId,workspaceId,assetId)))
      throw new NotFoundError("You need an active license to edit a purchased model.");
  }
  const next=associations.map(a=>({...a,placement:requested.get(a.identifier)!}));
  const updated=await updateWorld(userId,workspaceId,worldId,{
    assetAssociations:next,changeNote:"Updated 3D asset placements in World Layout Studio",
  });
  return {worldId:updated.id,version:updated.currentVersion,updated:true};
}
