import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { WORLD_PRESETS } from "@/lib/worlds/presets";
import { isMarketModelReference } from "@/lib/marketplace/model-ref";
import { visualProfileInputSchema, DEFAULT_VISUAL_PROFILE } from "@/lib/visuals/profile";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createAsset } from "./asset-service";
import { createEntity, getEntity } from "./entity-service";
import { createWorld, getWorld } from "./world-service";
import { acquireFree, createMarketListing, openSeller, submitMarketListing, moderateMarketListing } from "./marketplace-service";
import { useMarketplaceModelInEntity, attachMarketplaceAssetToWorld } from "./marketplace-placement-service";

beforeEach(async()=>await resetDb());
let count=0;
async function account() {
  const n=++count;
  return registerUser({displayName:"Market Player "+n,email:"market-placement-"+n+"-"+Date.now()+"@example.com",
    password:"Password123",confirmPassword:"Password123"});
}
async function fixture(){
  const creator=await account(),buyer=await account(),stranger=await account(),moderator=await account();
  const asset=await createAsset(creator.user.id,creator.workspaceId,{
    name:"Licensed Lion",description:"Original lion 3D model",type:"CREATURE",status:"VALIDATED",
    tags:[],provenance:{kind:"ORIGINAL"},
    externalReference:"https://creator.example.org/models/lion.glb",
    technicalMetadata:{},productionChecklist:[],entityAssociations:[],derivedFromAssetIds:[],
  });
  await openSeller(creator.user.id,creator.workspaceId,{slug:"creator-market-"+count,displayName:"Creator Market",bio:"Originals"});
  const listing=await createMarketListing(creator.user.id,creator.workspaceId,{
    sourceAssetId:asset.id,title:"Lion 3D model",description:"Original 3D creature model",category:"CREATURES",priceMinor:0,
  });
  await submitMarketListing(creator.user.id,creator.workspaceId,listing.id,{action:"SUBMIT"});
  await prisma.marketModeratorGrant.create({data:{userId:moderator.user.id,isActive:true}});
  await moderateMarketListing(moderator.user.id,listing.id,true,"Approved");
  const owned=await acquireFree(buyer.user.id,{listingId:listing.id});
  const entity=await createEntity(buyer.user.id,buyer.workspaceId,{name:"My Lion",category:"animal"});
  const preset=WORLD_PRESETS[0]!;
  const world=await createWorld(buyer.user.id,buyer.workspaceId,{
    name:"My Savannah",description:"Private test world",category:"natural-environment",status:"DRAFT",
    tags:[],biome:preset.biome,visibility:"PRIVATE",
    blueprint:structuredClone(preset.blueprint),assetAssociations:[],entityAssociations:[],
  });
  return {creator,buyer,stranger,owned,entity,world};
}
describe("marketplace destination integration",()=>{
  it("accepts only safe GLB endpoints including private SIMVERSE file routes",()=>{
    const privatePath="/api/marketplace/files/"+"a".repeat(32);
    expect(isMarketModelReference(privatePath)).toBe(true);
    expect(visualProfileInputSchema.safeParse({
      ...DEFAULT_VISUAL_PROFILE,sourceType:"MODEL_3D",modelUrl:privatePath,
    }).success).toBe(true);
    expect(isMarketModelReference("https://example.org/horse.glb?token=abc")).toBe(false);
    expect(isMarketModelReference("//attacker.example/file.glb")).toBe(false);
    expect(isMarketModelReference("/api/marketplace/files/not-safe")).toBe(false);
  });
  it("lets the licensed buyer choose an Entity, without granting unlicensed players access",async()=>{
    const a=await fixture();
    await expect(useMarketplaceModelInEntity(a.stranger.user.id,a.stranger.workspaceId,a.owned.id,a.entity.id))
      .rejects.toBeInstanceOf(NotFoundError);
    const placed=await useMarketplaceModelInEntity(a.buyer.user.id,a.buyer.workspaceId,a.owned.id,a.entity.id);
    expect(placed.updated).toBe(true);
    const entity=await getEntity(a.buyer.user.id,a.buyer.workspaceId,a.entity.id);
    expect(entity.visualProfile).toMatchObject({
      sourceType:"MODEL_3D",modelUrl:"https://creator.example.org/models/lion.glb",archetype:"QUADRUPED",
    });
    const repeated=await useMarketplaceModelInEntity(a.buyer.user.id,a.buyer.workspaceId,a.owned.id,a.entity.id);
    expect(repeated.updated).toBe(false);
    expect((await getEntity(a.buyer.user.id,a.buyer.workspaceId,a.entity.id)).visualProfile?.revision)
      .toBe(entity.visualProfile?.revision);
  });
  it("pins a bought asset into the buyer's World, without adding geometry automatically",async()=>{
    const a=await fixture();
    await expect(attachMarketplaceAssetToWorld(a.stranger.user.id,a.stranger.workspaceId,a.owned.id,a.world.id))
      .rejects.toBeInstanceOf(NotFoundError);
    const first=await attachMarketplaceAssetToWorld(a.buyer.user.id,a.buyer.workspaceId,a.owned.id,a.world.id);
    expect(first.updated).toBe(true);
    const world=await getWorld(a.buyer.user.id,a.buyer.workspaceId,a.world.id);
    expect(world.assets).toHaveLength(1);
    expect(world.assets[0]?.assetId).toBe(first.assetId);
    expect(world.assets[0]?.role).toBe("PROP");
    expect(world.version.assetAssociations[0]?.configuration).toMatchObject({
      marketplaceEntitlementId:a.owned.id,licensed:true,
    });
    const repeated=await attachMarketplaceAssetToWorld(a.buyer.user.id,a.buyer.workspaceId,a.owned.id,a.world.id);
    expect(repeated.updated).toBe(false);
    expect((await getWorld(a.buyer.user.id,a.buyer.workspaceId,a.world.id)).currentVersion).toBe(world.currentVersion);
  });
});
