import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { WORLD_PRESETS } from "@/lib/worlds/presets";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createAsset } from "./asset-service";
import { createWorld, getWorld } from "./world-service";
import { loadWorldLayout, saveWorldLayout } from "./world-layout-service";
import { acquireFree, createMarketListing, importEntitledAsset, moderateMarketListing, openSeller, submitMarketListing } from "./marketplace-service";

beforeEach(async()=>await resetDb());
let sequence=0;
async function account(){
  sequence++;
  return registerUser({
    displayName:"Layout User "+sequence,
    email:"layout-"+sequence+"-"+Date.now()+"@example.com",
    password:"Password123",confirmPassword:"Password123",
  });
}
function worldConfig(links:unknown[]=[]){
  const preset=WORLD_PRESETS[0]!;
  return {
    name:"Interactive Savannah",category:"natural-environment",biome:preset.biome,status:"DRAFT",
    description:"Layout preview test World",tags:[],visibility:"PRIVATE",
    blueprint:structuredClone(preset.blueprint),assetAssociations:links,entityAssociations:[],
  };
}
async function ownedAsset(userId:string,workspaceId:string){
  return createAsset(userId,workspaceId,{
    name:"My original 3D lion",description:"Self-contained original GLB",type:"CREATURE",
    status:"VALIDATED",tags:[],provenance:{kind:"ORIGINAL"},
    externalReference:"https://assets.example.org/lion.glb",
    technicalMetadata:{},productionChecklist:[],entityAssociations:[],derivedFromAssetIds:[],
  });
}
const defaultPlacement={
  position:{x:0,y:0,z:0},rotationDegrees:{pitch:0,yaw:0,roll:0},scale:{x:1,y:1,z:1},
};
describe("interactive World Layout Studio: saved versions and ownership",()=>{
  it("loads a real owned GLB reference and saves position, yaw and scale",async()=>{
    const owner=await account();
    const lion=await ownedAsset(owner.user.id,owner.workspaceId);
    const world=await createWorld(owner.user.id,owner.workspaceId,worldConfig([{
      identifier:"lion_main",assetId:lion.id,assetVersion:lion.currentVersion,role:"PROP",
      placement:defaultPlacement,configuration:{},
    }]));
    const initial=await loadWorldLayout(owner.user.id,owner.workspaceId,world.id);
    expect(initial.items[0]?.modelUrl).toBe("https://assets.example.org/lion.glb");
    const next={...defaultPlacement,position:{x:8,y:0,z:-5},
      rotationDegrees:{pitch:0,yaw:90,roll:0},scale:{x:1.5,y:1.5,z:1.5}};
    const updated=await saveWorldLayout(owner.user.id,owner.workspaceId,world.id,{
      expectedVersion:initial.version,placements:[{identifier:"lion_main",placement:next}],
    });
    expect(updated.version).toBe(world.currentVersion+1);
    const after=await getWorld(owner.user.id,owner.workspaceId,world.id);
    expect(after.version.assetAssociations[0]?.placement).toEqual(next);
    await expect(saveWorldLayout(owner.user.id,owner.workspaceId,world.id,{
      expectedVersion:initial.version,placements:[{identifier:"lion_main",placement:next}],
    })).rejects.toBeInstanceOf(ConflictError);
  });
  it("rejects foreign Worlds, unknown identifiers, and positions outside World boundaries",async()=>{
    const owner=await account(),stranger=await account();
    const asset=await ownedAsset(owner.user.id,owner.workspaceId);
    const world=await createWorld(owner.user.id,owner.workspaceId,worldConfig([{
      identifier:"model_a",assetId:asset.id,assetVersion:asset.currentVersion,role:"PROP",
      configuration:{},
    }]));
    await expect(loadWorldLayout(stranger.user.id,stranger.workspaceId,world.id))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(saveWorldLayout(owner.user.id,owner.workspaceId,world.id,{
      expectedVersion:world.currentVersion,
      placements:[{identifier:"foreign_asset",placement:defaultPlacement}],
    })).rejects.toBeInstanceOf(ConflictError);
    await expect(saveWorldLayout(owner.user.id,owner.workspaceId,world.id,{
      expectedVersion:world.currentVersion,
      placements:[{identifier:"model_a",placement:{
        ...defaultPlacement,position:{x:999999,y:0,z:0},
      }}],
    })).rejects.toBeInstanceOf(ValidationError);
    expect((await getWorld(owner.user.id,owner.workspaceId,world.id)).currentVersion).toBe(world.currentVersion);
  });
  it("hides a buyer's private imported GLB from workspace colleagues without their own license",async()=>{
    const creator=await account(),buyer=await account(),viewer=await account(),mod=await account();
    const original=await ownedAsset(creator.user.id,creator.workspaceId);
    await openSeller(creator.user.id,creator.workspaceId,{slug:"layout-test-"+sequence,displayName:"Layout Shop",bio:"Original assets"});
    const listing=await createMarketListing(creator.user.id,creator.workspaceId,{
      sourceAssetId:original.id,title:"Savannah Lion",description:"Original 3D model of a lion",category:"CREATURES",
      priceMinor:0,
    });
    await submitMarketListing(creator.user.id,creator.workspaceId,listing.id,{action:"SUBMIT"});
    await prisma.marketModeratorGrant.create({data:{userId:mod.user.id,isActive:true}});
    await moderateMarketListing(mod.user.id,listing.id,true,"Approved");
    const entitled=await acquireFree(buyer.user.id,{listingId:listing.id});
    const imported=await importEntitledAsset(buyer.user.id,buyer.workspaceId,entitled.id);
    const world=await createWorld(buyer.user.id,buyer.workspaceId,worldConfig([{
      identifier:"market_lion",assetId:imported.id,assetVersion:imported.currentVersion,
      role:"PROP",placement:defaultPlacement,configuration:{},
    }]));
    await prisma.workspaceMember.create({data:{
      userId:viewer.user.id,workspaceId:buyer.workspaceId,role:"VIEWER",
    }});
    expect((await loadWorldLayout(buyer.user.id,buyer.workspaceId,world.id)).items[0]?.modelUrl)
      .toBe("https://assets.example.org/lion.glb");
    expect((await loadWorldLayout(viewer.user.id,buyer.workspaceId,world.id)).items[0]?.modelUrl).toBeNull();
  });
});
