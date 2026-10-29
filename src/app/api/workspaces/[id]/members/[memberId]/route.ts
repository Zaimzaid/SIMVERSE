import type {NextRequest} from "next/server";
import {requireApiContext} from "@/server/api/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {changeWorkspaceMemberRole,removeWorkspaceMember} from "@/server/services/team-service";
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string;memberId:string}>}) {
 try{const {userId}=await requireApiContext();const {id,memberId}=await params;return dataResponse({member:await changeWorkspaceMemberRole(userId,id,memberId,await req.json().catch(()=>({})))})}catch(e){return errorResponse(e);}
}
export async function DELETE(_req:NextRequest,{params}:{params:Promise<{id:string;memberId:string}>}) {
 try{const {userId}=await requireApiContext();const {id,memberId}=await params;await removeWorkspaceMember(userId,id,memberId);return dataResponse({ok:true});}catch(e){return errorResponse(e);}
}
