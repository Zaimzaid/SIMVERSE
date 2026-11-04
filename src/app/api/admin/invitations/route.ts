import {dataResponse,errorResponse} from "@/server/api/response";
import {createAdminInvitation} from "@/server/admin/service";
import {requireAdminSameOrigin} from "@/server/admin/origin";
export async function POST(request:Request){
 try{
  requireAdminSameOrigin(request);
  const body=await request.json().catch(()=>({}));
  return dataResponse(await createAdminInvitation(body),201);
 }catch(error){return errorResponse(error);}
}
