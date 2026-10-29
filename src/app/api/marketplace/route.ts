import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { ValidationError } from "@/lib/errors";
import {
  acquireFree, createMarketListing, getMySeller, importEntitledAsset, myMarketLibrary, myWishlist,
  moderateMarketListing, openSeller, proposeTrade, publicCatalog, publicListing,
  requestPaidCheckout, reviewQueue, sellerListings, setWishlist, submitMarketListing,
} from "@/server/services/marketplace-service";
import { z } from "zod";
import { parseOrThrow } from "@/lib/validation";
const actionSchema=z.object({action:z.string().min(1).max(70)}).passthrough();
const idSchema=z.string().min(1).max(200);

export async function GET(request:NextRequest) {
  try {
    const p=request.nextUrl.searchParams, scope=p.get("scope")??"catalog";
    if (scope==="catalog") return dataResponse(await publicCatalog({
      q:p.get("q")??"",category:p.get("category")??"",
      page:Number(p.get("page")??1),
    }));
    if (scope==="listing") return dataResponse({listing:await publicListing(parseOrThrow(idSchema,p.get("id")))});
    const {userId,workspaceId}=await requireApiContext();
    if (scope==="seller") return dataResponse({seller:await getMySeller(userId,workspaceId),listings:await sellerListings(userId,workspaceId)});
    if (scope==="library") return dataResponse({items:await myMarketLibrary(userId)});
    if (scope==="wishlist") return dataResponse({items:await myWishlist(userId)});
    if (scope==="review-queue") return dataResponse({items:await reviewQueue(userId)});
    throw new ValidationError("Unknown marketplace scope.");
  } catch(error) {return errorResponse(error);}
}

export async function POST(request:NextRequest) {
  try {
    const {userId,workspaceId}=await requireApiContext();
    const body=parseOrThrow(actionSchema,await request.json().catch(()=>({})));
    switch(body.action) {
      case "open-seller": return dataResponse({seller:await openSeller(userId,workspaceId,body.payload)},201);
      case "create-listing": return dataResponse({listing:await createMarketListing(userId,workspaceId,body.payload)},201);
      case "submit-listing": return dataResponse({listing:await submitMarketListing(userId,workspaceId,parseOrThrow(idSchema,body.id),body.payload)});
      case "acquire-free": return dataResponse({entitlement:await acquireFree(userId,body.payload)},201);
      case "wishlist": return dataResponse(await setWishlist(userId,body.payload));
      case "import-entitlement": return dataResponse({asset:await importEntitledAsset(userId,workspaceId,parseOrThrow(idSchema,body.id))},201);
      case "review": return dataResponse({listing:await moderateMarketListing(userId,parseOrThrow(idSchema,body.id),body.approve===true,String(body.note??""))});
      case "checkout": return await requestPaidCheckout(userId,body.payload);
      case "trade-offer": return await proposeTrade(userId,body.payload);
      default: throw new ValidationError("Unknown marketplace action.");
    }
  }catch(error) {return errorResponse(error);}
}
