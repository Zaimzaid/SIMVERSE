import {resendEmailVerification} from "@/server/services/email-verification-service";
import {dataResponse,errorResponse} from "@/server/api/response";
export async function POST(req:Request){
 try{const b=await req.json().catch(()=>({}));const email=String(b?.email??"");
 if(email.length<=254 && email.includes("@"))await resendEmailVerification(email);
 return dataResponse({ok:true});
 }catch(e){return errorResponse(e);}
}
