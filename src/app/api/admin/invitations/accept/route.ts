import {AuthenticationError} from "@/lib/errors";
import {getSessionUser} from "@/server/auth/session";
import {setAdminStepupCookie} from "@/server/admin/access";
import {requireAdminSameOrigin} from "@/server/admin/origin";
import {acceptAdminInvitation} from "@/server/admin/service";
import {dataResponse,errorResponse} from "@/server/api/response";
export async function POST(request:Request){
 try{
  requireAdminSameOrigin(request);
  const user=await getSessionUser();
  if(!user)throw new AuthenticationError("Sign in with the invited email address first.");
  const body=await request.json().catch(()=>({}));
  const result=await acceptAdminInvitation(user.id,String(body?.token??""),body?.code);
  await setAdminStepupCookie(user.id);
  return dataResponse(result);
 }catch(error){return errorResponse(error);}
}
