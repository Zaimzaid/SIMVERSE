import type {NextRequest} from "next/server";
import {requireApiContext} from "@/server/api/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {removeProjectAssignment,updateProjectAssignment} from "@/server/services/project-assignment-service";
export async function PATCH(req:NextRequest,{params}:{params:Promise<{projectId:string;assignmentId:string}>}){
 try{const {userId,workspaceId}=await requireApiContext();const {projectId,assignmentId}=await params;
 return dataResponse(await updateProjectAssignment(userId,workspaceId,projectId,assignmentId,await req.json().catch(()=>({}))))}catch(e){return errorResponse(e);}
}
export async function DELETE(_req:NextRequest,{params}:{params:Promise<{projectId:string;assignmentId:string}>}){
 try{const {userId,workspaceId}=await requireApiContext();const {projectId,assignmentId}=await params;
 await removeProjectAssignment(userId,workspaceId,projectId,assignmentId);return dataResponse({ok:true});}catch(e){return errorResponse(e);}
}
