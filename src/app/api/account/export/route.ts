import {getSessionUser} from "@/server/auth/session";
import {AuthenticationError} from "@/lib/errors";
import {errorResponse} from "@/server/api/response";
import {createAccountExport} from "@/server/services/account-data-service";
export async function GET(){
 try{const user=await getSessionUser();if(!user)throw new AuthenticationError();
  const data=await createAccountExport(user.id);
  return new Response(JSON.stringify(data,null,2),{headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Content-Disposition":'attachment; filename="simverse-account-export.json"',
    "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff",
  }});
 }catch(e){return errorResponse(e);}
}
