import type {NextRequest} from "next/server";
import {requireApiContext} from "@/server/api/context";
import {setActiveWorkspaceCookie} from "@/server/auth/session";
import {dataResponse,errorResponse} from "@/server/api/response";
import {createAdditionalWorkspace} from "@/server/services/workspace-service";
export async function POST(req:NextRequest){
 try{const {userId}=await requireApiContext();const workspace=await createAdditionalWorkspace(userId,await req.json().catch(()=>({})));
 await setActiveWorkspaceCookie(workspace.id);return dataResponse({workspace},201);}catch(e){return errorResponse(e);}
}
