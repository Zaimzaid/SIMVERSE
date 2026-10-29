import { prisma } from "@/server/db/client";
import { parseOrThrow } from "@/lib/validation";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { requireMembership } from "@/server/services/workspace-service";
import {
  acquisitionSchema, canAcquireFree, canOfferTransfer, canSubmitListing,
  listingSchema, offerSchema, paidCommerceEnabled, reviewActionSchema,
  secondaryTradingEnabled, sellerSchema, wishlistSchema,
} from "@/lib/marketplace/contracts";

export async function publicCatalog(params: {q?:string;category?:string;page?:number} = {}) {
  const rawPage=params.page??1;
  const page=Number.isFinite(rawPage)?Math.max(1,Math.min(1000,Math.floor(rawPage))):1;
  const q = (params.q ?? "").trim().slice(0,120);
  const category = (params.category ?? "").trim().slice(0,60);
  const where = {
    status: "PUBLISHED",
    ...(category ? { category } : {}),
    ...(q ? { OR: [{title:{contains:q}},{description:{contains:q}}] } : {}),
  };
  const [total, listings] = await Promise.all([
    prisma.marketListing.count({where}),
    prisma.marketListing.findMany({where,orderBy:[{publishedAt:"desc"},{id:"asc"}],skip:(page-1)*18,take:18}),
  ]);
  const sellers = await prisma.marketSeller.findMany({
    where:{id:{in:listings.map(x=>x.sellerId)},status:"ACTIVE_FREE"},
    select:{id:true,slug:true,displayName:true,verified:true},
  });
  const byId = new Map(sellers.map(x=>[x.id,x]));
  const previews=await prisma.assetVersion.findMany({where:{OR:listings.map(x=>({assetId:x.sourceAssetId,version:x.sourceVersion}))},select:{assetId:true,version:true,thumbnailReference:true}});
  const thumbByAsset=new Map(previews.map(x=>[x.assetId+":"+x.version,x.thumbnailReference]));
  return {total,page,pageCount:Math.max(1,Math.ceil(total/18)),
    items:listings.filter(x=>byId.has(x.sellerId)).map(x=>({...x,seller:byId.get(x.sellerId),
      previewUrl:thumbByAsset.get(x.sourceAssetId+":"+x.sourceVersion)??null}))};
}

export async function publicListing(id:string) {
  const listing = await prisma.marketListing.findFirst({where:{id,status:"PUBLISHED"}});
  if (!listing) throw new NotFoundError("This item is not available.");
  const seller = await prisma.marketSeller.findFirst({where:{id:listing.sellerId,status:"ACTIVE_FREE"},
    select:{id:true,slug:true,displayName:true,bio:true,verified:true}});
  if (!seller) throw new NotFoundError("This item is not available.");
  const preview=await prisma.assetVersion.findFirst({where:{assetId:listing.sourceAssetId,version:listing.sourceVersion},select:{thumbnailReference:true}});
  return {...listing,seller,previewUrl:preview?.thumbnailReference??null};
}

export async function getMySeller(userId:string,workspaceId:string) {
  await requireMembership(userId,workspaceId,"asset.view");
  return prisma.marketSeller.findUnique({where:{ownerUserId_workspaceId:{ownerUserId:userId,workspaceId}}});
}

export async function openSeller(userId:string,workspaceId:string,input:unknown) {
  await requireMembership(userId,workspaceId,"asset.manage");
  const data = parseOrThrow(sellerSchema,input);
  const old = await getMySeller(userId,workspaceId);
  if (old) throw new ConflictError("You already have a store in this workspace.");
  return prisma.marketSeller.create({data:{...data,ownerUserId:userId,workspaceId}});
}

async function requireSeller(userId:string,workspaceId:string) {
  await requireMembership(userId,workspaceId,"asset.manage");
  const seller = await getMySeller(userId,workspaceId);
  if (!seller || seller.status !== "ACTIVE_FREE") throw new AuthorizationError("An active seller store is required.");
  return seller;
}
async function ownAsset(userId:string,workspaceId:string,assetId:string) {
  // Asset service enforces the authoritative workspace boundary and permissions.
  const {getAsset} = await import("@/server/services/asset-service");
  return getAsset(userId,workspaceId,assetId);
}
export async function createMarketListing(userId:string,workspaceId:string,input:unknown) {
  const seller = await requireSeller(userId,workspaceId);
  const data = parseOrThrow(listingSchema,input);
  if (data.priceMinor !== 0) throw new ValidationError("Paid listings are not enabled yet.");
  if (data.productKind === "IN_GAME_ITEM") throw new ValidationError("Game-item trading needs a verified inventory runtime.");
  const asset = await ownAsset(userId,workspaceId,data.sourceAssetId);
  if (asset.workspaceId !== seller.workspaceId) throw new NotFoundError();
  if (asset.version.provenance.kind !== "ORIGINAL")
    throw new ValidationError("Only original creator assets can be submitted in this pilot.");
  return prisma.marketListing.create({data:{
    sellerId:seller.id,sourceAssetId:asset.id,sourceVersion:asset.currentVersion,
    title:data.title,description:data.description,category:data.category,
    productKind:data.productKind,licenseType:data.licenseType,priceMinor:0,transferable:false,
  }});
}
export async function sellerListings(userId:string,workspaceId:string) {
  const seller = await getMySeller(userId,workspaceId);
  return seller?prisma.marketListing.findMany({where:{sellerId:seller.id},orderBy:{createdAt:"desc"}}):[];
}
export async function submitMarketListing(userId:string,workspaceId:string,id:string,input:unknown) {
  const seller = await requireSeller(userId,workspaceId);
  const {action} = parseOrThrow(reviewActionSchema,input);
  const listing = await prisma.marketListing.findFirst({where:{id,sellerId:seller.id}});
  if (!listing) throw new NotFoundError("Listing not found.");
  if (action==="WITHDRAW") {
    if (!["IN_REVIEW","PUBLISHED"].includes(listing.status)) throw new ConflictError("Cannot withdraw this listing.");
    return prisma.marketListing.update({where:{id},data:{status:"ARCHIVED"}});
  }
  const asset = await ownAsset(userId,workspaceId,listing.sourceAssetId);
  if (asset.currentVersion !== listing.sourceVersion) throw new ConflictError("Create a new listing for the latest asset version.");
  if (asset.version.provenance.kind !== "ORIGINAL") throw new ValidationError("Only original assets can be submitted.");
  if (!canSubmitListing(listing,{status:asset.status,externalReference:asset.version.externalReference}))
    throw new ValidationError("A validated original asset with a real source file reference is required.");
  return prisma.marketListing.update({where:{id},data:{status:"IN_REVIEW",reviewNote:null,reviewedById:null,reviewedAt:null}});
}

/** Moderator authority is provisioned independently, never inferred from workspace roles. */
export async function moderateMarketListing(userId:string,id:string,approve:boolean,note:string) {
  const moderator = await prisma.marketModeratorGrant.findUnique({where:{userId}});
  if (!moderator?.isActive) throw new AuthorizationError("Marketplace moderator permission is required.");
  const listing = await prisma.marketListing.findUnique({where:{id}});
  if (!listing || listing.status!=="IN_REVIEW") throw new NotFoundError("No pending listing.");
  const seller = await prisma.marketSeller.findUnique({where:{id:listing.sellerId}});
  if (!seller || seller.status!=="ACTIVE_FREE") throw new ConflictError("Seller is unavailable.");
  if (seller.ownerUserId===userId) throw new AuthorizationError("You cannot review your own listing.");
  const ownerAccess = await prisma.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId:seller.workspaceId,userId:seller.ownerUserId}}});
  if (!ownerAccess) throw new ConflictError("Seller has no valid workspace membership.");
  const asset = await prisma.asset.findFirst({where:{id:listing.sourceAssetId,workspaceId:seller.workspaceId}});
  const version = asset ? await prisma.assetVersion.findFirst({where:{assetId:asset.id,version:listing.sourceVersion}}) : null;
  if (!asset || !version || !["VALIDATED","RUNTIME_READY"].includes(asset.status) || !version.externalReference || listing.priceMinor !== 0)
    throw new ConflictError("Underlying asset is unavailable or no longer valid.");
  return prisma.marketListing.update({where:{id},data:{
    status:approve?"PUBLISHED":"REJECTED",
    reviewedById:userId,reviewedAt:new Date(),reviewNote:note.trim().slice(0,1000),
    publishedAt:approve?new Date():null,
  }});
}
export async function reviewQueue(userId:string) {
  const grant = await prisma.marketModeratorGrant.findUnique({where:{userId}});
  if (!grant?.isActive) throw new AuthorizationError();
  const listings=await prisma.marketListing.findMany({where:{status:"IN_REVIEW"},orderBy:{createdAt:"asc"},take:100});
  const files=await prisma.assetVersion.findMany({
    where:{OR:listings.map(l=>({assetId:l.sourceAssetId,version:l.sourceVersion}))},
    select:{assetId:true,version:true,externalReference:true,thumbnailReference:true,provenance:true},
  });
  const fileMap=new Map(files.map(f=>[f.assetId+":"+f.version,f]));
  return listings.map(l=>({...l,source:fileMap.get(l.sourceAssetId+":"+l.sourceVersion)??null}));
}

export async function acquireFree(userId:string,input:unknown) {
  const {listingId}=parseOrThrow(acquisitionSchema,input);
  // A transaction prevents an entitlement from being issued for a withdrawn listing.
  return prisma.$transaction(async tx=>{
    const listing=await tx.marketListing.findUnique({where:{id:listingId}});
    if (!listing || !canAcquireFree(listing)) throw new ConflictError("This item is not available for free acquisition.");
    const seller=await tx.marketSeller.findUnique({where:{id:listing.sellerId}});
    if (!seller || seller.status!=="ACTIVE_FREE") throw new ConflictError("Seller is unavailable.");
    const asset=await tx.asset.findFirst({where:{id:listing.sourceAssetId,workspaceId:seller.workspaceId}});
    if (!asset || !["VALIDATED","RUNTIME_READY"].includes(asset.status))
      throw new ConflictError("The asset is no longer available.");
    const version=await tx.assetVersion.findFirst({where:{assetId:asset.id,version:listing.sourceVersion}});
    if (!version?.externalReference) throw new ConflictError("No downloadable source is currently available.");
    return tx.marketEntitlement.upsert({
      where:{userId_listingId:{userId,listingId}},
      create:{userId,listingId,assetId:listing.sourceAssetId,assetVersion:listing.sourceVersion,licenseType:listing.licenseType,transferable:false,source:"FREE"},
      update:{}, // Idempotent; does not re-activate revoked entitlements.
    });
  });
}
export async function myMarketLibrary(userId:string) {
  const entries=await prisma.marketEntitlement.findMany({where:{userId,status:"ACTIVE"},orderBy:{createdAt:"desc"}});
  const ids=entries.map(x=>x.listingId);
  const listings=await prisma.marketListing.findMany({where:{id:{in:ids}}});
  const byId=new Map(listings.map(x=>[x.id,x]));
  const versions=await prisma.assetVersion.findMany({
    where:{OR:entries.map(e=>({assetId:e.assetId,version:e.assetVersion}))},
    select:{assetId:true,version:true,externalReference:true},
  });
  const versionByKey=new Map(versions.map(v=>[v.assetId+":"+v.version,v]));
  return entries.map(x=>{
    const ref=versionByKey.get(x.assetId+":"+x.assetVersion)?.externalReference;
    const modelUrl=ref && (/^\\/api\\/marketplace\\/files\\/[a-f0-9]{32}$/.test(ref) || /\\.glb(?:[?#]|$)/i.test(ref))?ref:null;
    return {...x,listing:byId.get(x.listingId)??null,modelUrl};
  });
}
export async function setWishlist(userId:string,input:unknown) {
  const {listingId,saved}=parseOrThrow(wishlistSchema,input);
  if (saved) {
    await publicListing(listingId);
    return prisma.marketWishlist.upsert({where:{userId_listingId:{userId,listingId}},create:{userId,listingId},update:{}});
  }
  await prisma.marketWishlist.deleteMany({where:{userId,listingId}});
  return {saved:false};
}
export async function myWishlist(userId:string) {
  const rows=await prisma.marketWishlist.findMany({where:{userId},orderBy:{createdAt:"desc"}});
  const allowed=await prisma.marketListing.findMany({where:{id:{in:rows.map(r=>r.listingId)},status:"PUBLISHED"}});
  const byId=new Map(allowed.map(x=>[x.id,x]));
  return rows.map(x=>byId.get(x.listingId)).filter((x):x is NonNullable<typeof x>=>Boolean(x));
}


/**
 * Import a licensed reference into the buyer's own workspace Asset Library.
 * This is NOT secure binary delivery; the source link may require separate host
 * access and runtime compatibility remains unverified. Never grants resale.
 */
export async function importEntitledAsset(userId:string,workspaceId:string,entitlementId:string) {
  await requireMembership(userId,workspaceId,"asset.manage");
  const entry=await prisma.marketEntitlement.findFirst({where:{id:entitlementId,userId,status:"ACTIVE"}});
  if(!entry)throw new NotFoundError("Owned marketplace item not found.");
  const existing=await prisma.marketImport.findUnique({where:{entitlementId_workspaceId:{entitlementId,workspaceId}}});
  if(existing?.status==="COMPLETE"&&existing.importedAssetId) {
    const {getAsset}=await import("@/server/services/asset-service");
    return getAsset(userId,workspaceId,existing.importedAssetId);
  }
  if(existing)throw new ConflictError("This import is already in progress.");
  const listing=await prisma.marketListing.findUnique({where:{id:entry.listingId}});
  const seller=listing?await prisma.marketSeller.findUnique({where:{id:listing.sellerId}}):null;
  if(!listing||!seller)throw new NotFoundError("Original asset is unavailable.");
  const source=await prisma.asset.findFirst({where:{id:entry.assetId,workspaceId:seller.workspaceId}});
  const version=source?await prisma.assetVersion.findFirst({where:{assetId:source.id,version:entry.assetVersion}}):null;
  if(!source||!version?.externalReference)throw new ConflictError("Original file reference is unavailable.");
  // Unique reservation prevents simultaneous duplicate imports to the same workspace.
  try{
    await prisma.marketImport.create({data:{entitlementId,userId,workspaceId,status:"PENDING"}});
  }catch{throw new ConflictError("This item is being imported or is already imported.");}
  try {
    const read=(json:string|null,fallback:unknown)=>json?JSON.parse(json):fallback;
    const {createAsset}=await import("@/server/services/asset-service");
    const imported=await createAsset(userId,workspaceId,{
      name:listing.title,description:listing.description,type:source.type,status:"DRAFT",
      tags:read(version.tags,[]),
      provenance:{kind:"LICENSED",sourceName:seller.displayName,
        notes:"Imported through a user-owned SIMVERSE Marketplace entitlement; redistribution is not permitted."},
      licenseInfo:{type:"CUSTOM",name:`Marketplace ${entry.licenseType.toLowerCase()} license`,
        usageRestrictions:"Use only as allowed by the acquired SIMVERSE Marketplace license. No reselling or redistribution of the original source file."},
      authorInfo:read(version.authorInfo,undefined),
      externalReference:version.externalReference,
      thumbnailReference:version.thumbnailReference??undefined,
      technicalMetadata:read(version.technicalMetadata,{}),
      modelSpecification:read(version.modelSpecification,undefined),
      rigSpecification:read(version.rigSpecification,undefined),
      animationSpecification:read(version.animationSpecification,undefined),
      productionChecklist:read(version.productionChecklist,[]),
      entityAssociations:[],derivedFromAssetIds:[],
      changeNote:"Licensed marketplace reference import",
    });
    await prisma.marketImport.update({where:{entitlementId_workspaceId:{entitlementId,workspaceId}},data:{
      importedAssetId:imported.id,status:"COMPLETE",
    }});
    return imported;
  }catch(error){
    await prisma.marketImport.deleteMany({where:{entitlementId,workspaceId,status:"PENDING"}});
    throw error;
  }
}

/** P3: Never accept browser-authoritative payment confirmations or mint paid rights. */
export async function requestPaidCheckout(_userId:string,_input:unknown):Promise<never> {
  if (!paidCommerceEnabled()) throw new ConflictError("Paid checkout is not available. No payment has been taken.");
  throw new ConflictError("Verified payment provider integration is required before checkout.");
}
/** P4: No item transfers until an independently authoritative item inventory exists. */
export async function proposeTrade(_userId:string,input:unknown):Promise<never> {
  const data=parseOrThrow(offerSchema,input);
  if (!secondaryTradingEnabled()) throw new ConflictError("Player trading is not enabled.");
  const entitlement=await prisma.marketEntitlement.findUnique({where:{id:data.entitlementId}});
  if (!entitlement || !canOfferTransfer(entitlement)) throw new ConflictError("This item cannot be transferred.");
  throw new ConflictError("An escrow and transfer service is required.");
}
