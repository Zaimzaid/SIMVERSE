import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { loadWorldLayout, saveWorldLayout } from "@/server/services/world-layout-service";
import { parseOrThrow } from "@/lib/validation";
import { z } from "zod";

interface Context { params:Promise<{worldId:string}> }
const bodySchema=z.object({
  expectedVersion:z.number().int().positive(),
  placements:z.array(z.object({
    identifier:z.string().min(1).max(80),
    placement:z.object({
      position:z.object({x:z.number().finite(),y:z.number().finite(),z:z.number().finite()}).strict(),
      rotationDegrees:z.object({pitch:z.number().finite(),yaw:z.number().finite(),roll:z.number().finite()}).strict(),
      scale:z.object({x:z.number().finite().positive(),y:z.number().finite().positive(),z:z.number().finite().positive()}).strict(),
    }).strict(),
  }).strict()).max(500),
}).strict();

export async function GET(_request:NextRequest,context:Context){
  try{
    const {userId,workspaceId}=await requireApiContext();
    const {worldId}=await context.params;
    return dataResponse(await loadWorldLayout(userId,workspaceId,worldId));
  }catch(error){return errorResponse(error);}
}
export async function PATCH(request:NextRequest,context:Context){
  try{
    const {userId,workspaceId}=await requireApiContext();
    const {worldId}=await context.params;
    const parsed=parseOrThrow(bodySchema,await request.json().catch(()=>({})));
    return dataResponse(await saveWorldLayout(userId,workspaceId,worldId,parsed));
  }catch(error){return errorResponse(error);}
}
