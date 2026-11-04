import {dataResponse,errorResponse} from "@/server/api/response";
import {updateAdminStaff} from "@/server/admin/service";
import {requireAdminSameOrigin} from "@/server/admin/origin";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireAdminSameOrigin(request);
  const {id}=await params;
  return dataResponse(await updateAdminStaff(id,await request.json().catch(()=>({})));
 }catch(error){return errorResponse(error);}
}
