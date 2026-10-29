import {requireUser} from "@/server/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {listAccountSessions,revokeOtherAccountSessions} from "@/server/services/account-security-service";
export async function GET(){
 try{const user=await requireUser();return dataResponse({sessions:await listAccountSessions(user.id)});}catch(e){return errorResponse(e);}
}
export async function DELETE(){
 try{const user=await requireUser();await revokeOtherAccountSessions(user.id);return dataResponse({ok:true});}catch(e){return errorResponse(e);}
}
