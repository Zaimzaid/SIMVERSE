import type {NextRequest} from "next/server";
import {completeTwoFactorChallenge} from "@/server/services/two-factor-service";
import {createSession,setActiveWorkspaceCookie} from "@/server/auth/session";
import {listWorkspacesForUser} from "@/server/services/workspace-service";
import {dataResponse,errorResponse} from "@/server/api/response";
export async function POST(req:NextRequest){
 try{
  const userId=await completeTwoFactorChallenge(await req.json().catch(()=>({})));
  await createSession(userId,{userAgent:req.headers.get("user-agent"),ipAddress:req.headers.get("x-forwarded-for")});
  const workspaces=await listWorkspacesForUser(userId);
  if(workspaces[0])await setActiveWorkspaceCookie(workspaces[0].id);
  return dataResponse({ok:true});
 }catch(e){return errorResponse(e);}
}
