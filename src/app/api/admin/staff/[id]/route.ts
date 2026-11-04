import {dataResponse,errorResponse} from "@/server/api/response";
import {updateAdminStaff} from "@/server/admin/service";
import {requireAdminSameOrigin} from "@/server/admin/origin";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireAdminSameOrigin(request);
  const {id}=await params;
  const body=await request.json().catch(()=>({}));
  return dataResponse(await updateAdminStaff(id,body));
 }catch(error){return errorResponse(error);}
}
