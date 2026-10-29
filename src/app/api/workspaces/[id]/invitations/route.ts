import type {NextRequest} from "next/server";
import {requireApiContext} from "@/server/api/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {inviteWorkspaceMember,listWorkspaceInvitations} from "@/server/services/team-service";
import {requireMembership} from "@/server/services/workspace-service";
async function user(reqId:string) {
 const context=await requireApiContext();
 await requireMembership(context.userId,reqId,"workspace.members.manage");
 return context.userId;
}
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}) {
 try {const {id}=await params;return dataResponse({invitations:await listWorkspaceInvitations(await user(id),id)});}catch(e){return errorResponse(e);}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
 try {const {id}=await params;const actor=await user(id);return dataResponse(await inviteWorkspaceMember(actor,id,await req.json().catch(()=>({}))),201);}catch(e){return errorResponse(e);}
}
