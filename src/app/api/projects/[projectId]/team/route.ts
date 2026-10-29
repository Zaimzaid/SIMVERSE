import type {NextRequest} from "next/server";
import {requireApiContext} from "@/server/api/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {listProjectAssignments,assignProjectMember} from "@/server/services/project-assignment-service";
export async function GET(_req:NextRequest,{params}:{params:Promise<{projectId:string}>}){
 try{const {userId,workspaceId}=await requireApiContext();const {projectId}=await params;return dataResponse({assignments:await listProjectAssignments(userId,workspaceId,projectId)});}
 catch(e){return errorResponse(e);}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{projectId:string}>}){
 try{const {userId,workspaceId}=await requireApiContext();const {projectId}=await params;return dataResponse({assignment:await assignProjectMember(userId,workspaceId,projectId,await req.json().catch(()=>({})))},201);}
 catch(e){return errorResponse(e);}
}
