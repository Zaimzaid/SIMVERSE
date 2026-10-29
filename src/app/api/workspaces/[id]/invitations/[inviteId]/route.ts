import {requireApiContext} from "@/server/api/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {revokeWorkspaceInvitation} from "@/server/services/team-service";
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string;inviteId:string}>}) {
 try{const {userId}=await requireApiContext();const {id,inviteId}=await params;await revokeWorkspaceInvitation(userId,id,inviteId);return dataResponse({ok:true});}catch(e){return errorResponse(e);}
}
