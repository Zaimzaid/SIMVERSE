import {requireUser} from "@/server/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {revokeAccountSession} from "@/server/services/account-security-service";
export async function DELETE(_req:Request,{params}:{params:Promise<{sessionId:string}>}){
 try{const user=await requireUser();const {sessionId}=await params;await revokeAccountSession(user.id,sessionId);return dataResponse({ok:true});}catch(e){return errorResponse(e);}
}
