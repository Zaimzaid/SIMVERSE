import {AuthenticationError,AuthorizationError} from "@/lib/errors";
import {getSessionUser} from "@/server/auth/session";
import {prisma} from "@/server/db/client";
import {dataResponse,errorResponse} from "@/server/api/response";
import {getPlatformStaff,setAdminStepupCookie,verifyAdminTotp} from "@/server/admin/access";
import {requireAdminSameOrigin} from "@/server/admin/origin";
export async function POST(request:Request){
 try{
  requireAdminSameOrigin(request);
  const user=await getSessionUser();
  if(!user)throw new AuthenticationError("Sign in first.");
  const staff=await getPlatformStaff(user.id);
  if(!staff?.active)throw new AuthorizationError("No active platform staff access.");
  const body=await request.json().catch(()=>({}));
  await verifyAdminTotp(user.id,body?.code);
  await setAdminStepupCookie(user.id);
  await prisma.auditLog.create({data:{actorUserId:user.id,action:"platform_admin.stepup_verified"}});
  return dataResponse({ok:true});
 }catch(error){return errorResponse(error);}
}
