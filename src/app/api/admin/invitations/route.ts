import {dataResponse,errorResponse} from "@/server/api/response";
import {createAdminInvitation} from "@/server/admin/service";
import {requireAdminSameOrigin} from "@/server/admin/origin";
export async function POST(request:Request){
 try{
  requireAdminSameOrigin(request);
  return dataResponse(await createAdminInvitation(await request.json().catch(()=>({})),201);
 }catch(error){return errorResponse(error);}
}
