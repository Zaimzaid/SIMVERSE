import { describe, expect, it } from "vitest";
import {
  canAcquireFree, canSubmitListing, canOfferTransfer,
  listingSchema, paidCommerceEnabled, secondaryTradingEnabled,
  sellerSchema,
} from "./contracts";

describe("Universal Marketplace P1–P4 safety contracts",()=>{
  it("requires a valid unique-url store name",()=>{
    expect(sellerSchema.safeParse({displayName:"Savannah",slug:"savannah-3d"}).success).toBe(true);
    expect(sellerSchema.safeParse({displayName:"Savannah",slug:"ADMIN/ROOT"}).success).toBe(false);
  });
  it("blocks nonzero pricing in free acquisition",()=>{
    expect(canAcquireFree({status:"PUBLISHED",priceMinor:0,productKind:"DIGITAL_ASSET"})).toBe(true);
    expect(canAcquireFree({status:"PUBLISHED",priceMinor:1,productKind:"DIGITAL_ASSET"})).toBe(false);
    expect(canAcquireFree({status:"DRAFT",priceMinor:0,productKind:"DIGITAL_ASSET"})).toBe(false);
    expect(canAcquireFree({status:"PUBLISHED",priceMinor:0,productKind:"IN_GAME_ITEM"})).toBe(false);
  });
  it("requires a validated asset with a source reference to submit",()=>{
    const listing={status:"DRAFT",priceMinor:0};
    expect(canSubmitListing(listing,{status:"VALIDATED",externalReference:"https://example.com/model.glb"})).toBe(true);
    expect(canSubmitListing(listing,{status:"VALIDATED",externalReference:null})).toBe(false);
    expect(canSubmitListing(listing,{status:"DRAFT",externalReference:"/models/example.glb"})).toBe(false);
    expect(canSubmitListing({status:"PUBLISHED",priceMinor:0},{status:"RUNTIME_READY",externalReference:"/models/example.glb"})).toBe(false);
    expect(canSubmitListing({status:"DRAFT",priceMinor:100},{status:"RUNTIME_READY",externalReference:"/models/example.glb"})).toBe(false);
  });
  it("validates product kinds and prices",()=>{
    const data={sourceAssetId:"asset-1",title:"Savannah lion",description:"High quality original model",category:"CREATURES"};
    expect(listingSchema.safeParse(data).success).toBe(true);
    expect(listingSchema.safeParse({...data,productKind:"COIN"}).success).toBe(false);
    expect(listingSchema.safeParse({...data,priceMinor:-100}).success).toBe(false);
  });
  it("disables paid fulfillment and secondary trades regardless of incoming requests",()=>{
    expect(paidCommerceEnabled()).toBe(false);
    expect(secondaryTradingEnabled()).toBe(false);
    expect(canOfferTransfer({status:"ACTIVE",transferable:false})).toBe(false);
    expect(canOfferTransfer({status:"REVOKED",transferable:true})).toBe(false);
  });
});
