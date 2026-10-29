import { z } from "zod";

export const listingCategories = ["CHARACTERS","CREATURES","CLOTHING","VEHICLES","BUILDINGS","PROPS","ENVIRONMENTS","ANIMATION","AUDIO","TEMPLATES","MATERIALS","GAME_ITEMS"] as const;
export const listingKinds = ["DIGITAL_ASSET","IN_GAME_ITEM","TEMPLATE"] as const;
export const marketplaceLicenses = ["PERSONAL","COMMERCIAL"] as const;
export const sellerSchema = z.object({
  displayName: z.string().trim().min(3).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),
  bio: z.string().trim().max(1200).default(""),
}).strict();
export const listingSchema = z.object({
  sourceAssetId: z.string().min(1).max(200),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  category: z.enum(listingCategories),
  productKind: z.enum(listingKinds).default("DIGITAL_ASSET"),
  licenseType: z.enum(marketplaceLicenses).default("PERSONAL"),
  priceMinor: z.number().int().min(0).max(100000000).default(0),
}).strict();
export const reviewActionSchema = z.object({
  action: z.enum(["SUBMIT","WITHDRAW"]),
}).strict();
export const offerSchema = z.object({
  entitlementId: z.string().min(1).max(200),
  buyerUserId: z.string().min(1).max(200),
}).strict();
export const wishlistSchema = z.object({
  listingId: z.string().min(1).max(200),
  saved: z.boolean(),
}).strict();
export const acquisitionSchema = z.object({
  listingId: z.string().min(1).max(200),
}).strict();

/** Free-first gate: never issue a paid entitlement from a client request. */
export function canAcquireFree(listing: {status:string;priceMinor:number;productKind:string}): boolean {
  return listing.status === "PUBLISHED" && listing.priceMinor === 0 &&
    (listing.productKind === "DIGITAL_ASSET" || listing.productKind === "TEMPLATE");
}
export function canOfferTransfer(entitlement: {status:string;transferable:boolean}): boolean {
  return entitlement.status === "ACTIVE" && entitlement.transferable;
}
export function canSubmitListing(listing: {status:string;priceMinor:number}, asset: {status:string;externalReference?:string|null}): boolean {
  return (listing.status === "DRAFT" || listing.status === "REJECTED") &&
    listing.priceMinor === 0 && (asset.status === "VALIDATED" || asset.status === "RUNTIME_READY") &&
    Boolean(asset.externalReference);
}
export function paidCommerceEnabled(): boolean { return false; }
export function secondaryTradingEnabled(): boolean { return false; }
