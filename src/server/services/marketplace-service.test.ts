import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createAsset, getAsset } from "./asset-service";
import {
  acquireFree, createMarketListing, importEntitledAsset, moderateMarketListing,
  myMarketLibrary, openSeller, proposeTrade, publicCatalog, publicListing,
  requestPaidCheckout, reviewQueue, sellerListings, submitMarketListing,
} from "./marketplace-service";

beforeEach(async()=>await resetDb());
let sequence=0;
async function user(){
  const id=++sequence;
  return registerUser({displayName:"Market test "+id,email:"market-"+id+"-"+Date.now()+"@example.com",password:"Password123",confirmPassword:"Password123"});
}
async function approvedAsset(uid:string,wsid:string,ref="https://assets.example.org/lion.glb"){
  return createAsset(uid,wsid,{
    name:"Savannah Lion",description:"Original lion model",type:"CREATURE",
    status:"VALIDATED",tags:["lion"],provenance:{kind:"ORIGINAL"},externalReference:ref,
    technicalMetadata:{},productionChecklist:[],entityAssociations:[],derivedFromAssetIds:[],
  });
}
async function setup(){
  const creator=await user(),buyer=await user(),moderator=await user();
  const asset=await approvedAsset(creator.user.id,creator.workspaceId);
  await openSeller(creator.user.id,creator.workspaceId,{slug:"lion-store-"+sequence,displayName:"Lion Works",bio:"Original assets"});
  const listing=await createMarketListing(creator.user.id,creator.workspaceId,{
    sourceAssetId:asset.id,title:"Lion model",description:"Original animated-ready lion 3D model for games",
    category:"CREATURES",licenseType:"PERSONAL",priceMinor:0,productKind:"DIGITAL_ASSET",
  });
  return {creator,buyer,moderator,asset,listing};
}
async function publish(ctx:Awaited<ReturnType<typeof setup>>){
  await prisma.marketModeratorGrant.create({data:{userId:ctx.moderator.user.id,isActive:true}});
  await submitMarketListing(ctx.creator.user.id,ctx.creator.workspaceId,ctx.listing.id,{action:"SUBMIT"});
  await moderateMarketListing(ctx.moderator.user.id,ctx.listing.id,true,"Original creator asset confirmed");
}
describe("Marketplace integration: role gates, seller approval and free entitlements",()=>{
  it("keeps draft and private source invisible; only separate moderator publishes",async()=>{
    const a=await setup();
    expect((await publicCatalog()).items).toHaveLength(0);
    await expect(publicListing(a.listing.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(submitMarketListing(a.buyer.user.id,a.buyer.workspaceId,a.listing.id,{action:"SUBMIT"})).rejects.toBeInstanceOf(AuthorizationError);
    await submitMarketListing(a.creator.user.id,a.creator.workspaceId,a.listing.id,{action:"SUBMIT"});
    await expect(moderateMarketListing(a.creator.user.id,a.listing.id,true,"")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(reviewQueue(a.buyer.user.id)).rejects.toBeInstanceOf(AuthorizationError);
    await prisma.marketModeratorGrant.create({data:{userId:a.moderator.user.id,isActive:true}});
    expect(await reviewQueue(a.moderator.user.id)).toHaveLength(1);
    await moderateMarketListing(a.moderator.user.id,a.listing.id,true,"Reviewed");
    expect((await publicCatalog()).items.map(x=>x.id)).toEqual([a.listing.id]);
    expect((await publicListing(a.listing.id)).title).toBe("Lion model");
  });
  it("issues exactly one buyer entitlement, enforces private library and blocks fresh withdrawn acquisitions",async()=>{
    const a=await setup();await publish(a);
    const first=await acquireFree(a.buyer.user.id,{listingId:a.listing.id});
    const repeated=await acquireFree(a.buyer.user.id,{listingId:a.listing.id});
    expect(first.id).toBe(repeated.id);
    expect(await prisma.marketEntitlement.count({where:{userId:a.buyer.user.id}})).toBe(1);
    expect(await myMarketLibrary(a.creator.user.id)).toHaveLength(0);
    expect(await myMarketLibrary(a.buyer.user.id)).toHaveLength(1);
    expect((await myMarketLibrary(a.buyer.user.id))[0]?.modelUrl).toBe("https://assets.example.org/lion.glb");
    await submitMarketListing(a.creator.user.id,a.creator.workspaceId,a.listing.id,{action:"WITHDRAW"});
    await expect(acquireFree(a.moderator.user.id,{listingId:a.listing.id})).rejects.toBeInstanceOf(ConflictError);
  });
  it("imports only a buyer's own entitlement to own workspace with original license metadata",async()=>{
    const a=await setup();await publish(a);
    const bought=await acquireFree(a.buyer.user.id,{listingId:a.listing.id});
    await expect(importEntitledAsset(a.creator.user.id,a.creator.workspaceId,bought.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(importEntitledAsset(a.moderator.user.id,a.creator.workspaceId,bought.id)).rejects.toBeInstanceOf(NotFoundError);
    const imported=await importEntitledAsset(a.buyer.user.id,a.buyer.workspaceId,bought.id);
    expect(imported.workspaceId).toBe(a.buyer.workspaceId);
    expect(imported.version.provenance.kind).toBe("LICENSED");
    expect(imported.version.licenseInfo?.type).toBe("CUSTOM");
    expect(imported.version.externalReference).toBe("https://assets.example.org/lion.glb");
    expect((await importEntitledAsset(a.buyer.user.id,a.buyer.workspaceId,bought.id)).id).toBe(imported.id);
    await expect(createMarketListing(a.buyer.user.id,a.buyer.workspaceId,{
      sourceAssetId:imported.id,title:"Resold Lion",description:"Unauthorized copy of the original lion",
      category:"CREATURES",licenseType:"COMMERCIAL",priceMinor:0,
    })).rejects.toBeInstanceOf(AuthorizationError);
    expect((await getAsset(a.buyer.user.id,a.buyer.workspaceId,imported.id)).id).toBe(imported.id);
  });
  it("rejects paid checkout, secondary transfers and browser-controlled prices",async()=>{
    const a=await setup();
    expect((await sellerListings(a.creator.user.id,a.creator.workspaceId))).toHaveLength(1);
    await expect(requestPaidCheckout(a.buyer.user.id,{listingId:a.listing.id})).rejects.toBeInstanceOf(ConflictError);
    await expect(proposeTrade(a.buyer.user.id,{entitlementId:"fake",buyerUserId:a.creator.user.id})).rejects.toBeInstanceOf(ConflictError);
    await expect(createMarketListing(a.creator.user.id,a.creator.workspaceId,{
      sourceAssetId:a.asset.id,title:"Paid lion",description:"Paid creator lion model",category:"CREATURES",priceMinor:10000,
    })).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.marketOrder.count()).toBe(0);
    expect(await prisma.marketTradeOffer.count()).toBe(0);
  });
});
