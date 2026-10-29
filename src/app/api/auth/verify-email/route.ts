import {verifyEmailToken} from "@/server/services/email-verification-service";
import {dataResponse,errorResponse} from "@/server/api/response";
export async function POST(req:Request){
 try{const b=await req.json().catch(()=>({}));await verifyEmailToken(String(b?.token??""));return dataResponse({ok:true});}catch(e){return errorResponse(e);}
}
