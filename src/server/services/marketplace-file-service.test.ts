import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createAsset, updateAsset } from "./asset-service";
import { acquireFree, createMarketListing, moderateMarketListing, openSeller, submitMarketListing } from "./marketplace-service";
import { readAuthorizedMarketGlb, uploadMarketGlb } from "./marketplace-file-service";

let root="";
const old=process.env.SIMVERSE_MARKETPLACE_STORAGE_DIR;
beforeEach(async()=>{
  await resetDb();
  root=await mkdtemp(join(tmpdir(),"simverse-market-glb-"));
  process.env.SIMVERSE_MARKETPLACE_STORAGE_DIR=root;
});
afterEach(async()=>{
  if(old===undefined)delete process.env.SIMVERSE_MARKETPLACE_STORAGE_DIR;
  else process.env.SIMVERSE_MARKETPLACE_STORAGE_DIR=old;
  if(root)await rm(root,{recursive:true,force:true});
});
let seq=0;
async function account(){
  seq+=1;return registerUser({
    displayName:"Uploader "+seq,email:"glb-"+seq+"-"+Date.now()+"@example.com",
    password:"Password123",confirmPassword:"Password123",
  });
}
function validGlb(){
  const json=new TextEncoder().encode(JSON.stringify({asset:{version:"2.0"},scenes:[{}],nodes:[{}]}));
  const padded=(json.length+3)&~3;
  const buffer=new Uint8Array(20+padded);
  const view=new DataView(buffer.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);
  view.setUint32(8,buffer.length,true);view.setUint32(12,padded,true);
  view.setUint32(16,0x4e4f534a,true);
  buffer.fill(0x20,20);buffer.set(json,20);
  return buffer;
}
describe("private creator GLB pilot",()=>{
  it("allows creator and separately authorized buyer reads but refuses unrelated users",async()=>{
    const creator=await account(),buyer=await account(),moderator=await account();
    const asset=await createAsset(creator.user.id,creator.workspaceId,{
      name:"Pilot Lion",type:"CREATURE",description:"Original creature asset",
      provenance:{kind:"ORIGINAL"},status:"DRAFT",tags:[],
      technicalMetadata:{},entityAssociations:[],derivedFromAssetIds:[],productionChecklist:[],
    });
    const bytes=validGlb();
    const uploaded=await uploadMarketGlb(creator.user.id,creator.workspaceId,asset.id,
      new File([new Uint8Array(bytes)],"lion.glb",{type:"model/gltf-binary"}));
    expect(uploaded.byteSize).toBe(bytes.length);
    expect(await readAuthorizedMarketGlb(creator.user.id,uploaded.id)).toEqual(Buffer.from(bytes));
    await expect(readAuthorizedMarketGlb(buyer.user.id,uploaded.id)).rejects.toBeInstanceOf(NotFoundError);
    await updateAsset(creator.user.id,creator.workspaceId,asset.id,{status:"IN_PRODUCTION"});
    await updateAsset(creator.user.id,creator.workspaceId,asset.id,{status:"REVIEW"});
    await updateAsset(creator.user.id,creator.workspaceId,asset.id,{status:"VALIDATED"});
    await openSeller(creator.user.id,creator.workspaceId,{
      slug:"private-glb-"+seq,displayName:"GLB Creator",bio:"Self-contained models",
    });
    const listing=await createMarketListing(creator.user.id,creator.workspaceId,{
      sourceAssetId:asset.id,title:"Real Pilot Lion",description:"An original self-contained 3D lion model",
      category:"CREATURES",priceMinor:0,
    });
    await submitMarketListing(creator.user.id,creator.workspaceId,listing.id,{action:"SUBMIT"});
    await prisma.marketModeratorGrant.create({data:{userId:moderator.user.id,isActive:true}});
    await moderateMarketListing(moderator.user.id,listing.id,true,"Reviewed");
    await acquireFree(buyer.user.id,{listingId:listing.id});
    expect(await readAuthorizedMarketGlb(buyer.user.id,uploaded.id)).toEqual(Buffer.from(bytes));
    const other=await account();
    await expect(readAuthorizedMarketGlb(other.user.id,uploaded.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
