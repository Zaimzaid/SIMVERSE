import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createAnimationProject, listAnimationProjects } from "@/server/services/animation-project-service";
export async function GET() {
  try { const {userId,workspaceId}=await requireApiContext(); return dataResponse({projects:await listAnimationProjects(userId,workspaceId)}); }
  catch(error){return errorResponse(error)}
}
export async function POST(request:Request) {
  try { const {userId,workspaceId}=await requireApiContext();
    return dataResponse({project:await createAnimationProject(userId,workspaceId,await request.json().catch(()=>({})))},201);
  }catch(error){return errorResponse(error)}
}
