import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { ValidationError } from "@/lib/errors";
import { MAX_FORM_BYTES, uploadMarketGlb } from "@/server/services/marketplace-file-service";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 try{
   const {userId,workspaceId}=await requireApiContext();
   const length=Number(request.headers.get("content-length")??0);
   if(!Number.isFinite(length)||length>MAX_FORM_BYTES)throw new ValidationError("Upload exceeds the 21 MB request limit.");
   const form=await request.formData();
   const file=form.get("file");
   const assetId=form.get("assetId");
   if(!(file instanceof File)||typeof assetId!=="string"||assetId.length>200||assetId.length<1)
     throw new ValidationError("Choose an asset and a GLB file.");
   return dataResponse({upload:await uploadMarketGlb(userId,workspaceId,assetId,file)},201);
 }catch(error){return errorResponse(error);}
}
