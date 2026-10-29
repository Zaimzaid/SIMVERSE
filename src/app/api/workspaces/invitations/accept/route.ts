import type {NextRequest} from "next/server";
import {AuthenticationError} from "@/lib/errors";
import {getSessionUser,setActiveWorkspaceCookie} from "@/server/auth/session";
import {dataResponse,errorResponse} from "@/server/api/response";
import {acceptWorkspaceInvitation} from "@/server/services/team-service";
export async function POST(req:NextRequest){
 try{const user=await getSessionUser();if(!user) throw new AuthenticationError("Sign in to join this workspace.");
 const body=await req.json().catch(()=>({}));const result=await acceptWorkspaceInvitation(user.id,String(body?.token??""));await setActiveWorkspaceCookie(result.workspaceId);return dataResponse(result);}catch(e){return errorResponse(e);}
}
