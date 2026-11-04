import {dataResponse,errorResponse} from "@/server/api/response";
import {revokeAdminInvitation} from "@/server/admin/service";
import {requireAdminSameOrigin} from "@/server/admin/origin";
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireAdminSameOrigin(request);
  const {id}=await params;
  return dataResponse(await revokeAdminInvitation(id));
 }catch(error){return errorResponse(error);}
}
