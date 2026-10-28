import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getAnimationProject, saveAnimationProject, deleteAnimationProject } from "@/server/services/animation-project-service";
type Params={params:Promise<{projectId:string}>};
export async function GET(_request:Request,{params}:Params){
  try {const {userId,workspaceId}=await requireApiContext();const {projectId}=await params;
    return dataResponse({project:await getAnimationProject(userId,workspaceId,projectId)});
  }catch(error){return errorResponse(error)}
}
export async function PATCH(request:Request,{params}:Params){
  try {const {userId,workspaceId}=await requireApiContext();const {projectId}=await params;
    return dataResponse({project:await saveAnimationProject(userId,workspaceId,projectId,await request.json().catch(()=>({})))});
  }catch(error){return errorResponse(error)}
}
export async function DELETE(_request:Request,{params}:Params){
  try {const {userId,workspaceId}=await requireApiContext();const {projectId}=await params;
    await deleteAnimationProject(userId,workspaceId,projectId);return dataResponse({success:true});
  }catch(error){return errorResponse(error)}
}
