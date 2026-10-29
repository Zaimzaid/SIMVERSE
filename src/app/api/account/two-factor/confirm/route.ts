import {getSessionUser} from "@/server/auth/session";
import {AuthenticationError} from "@/lib/errors";
import {dataResponse,errorResponse} from "@/server/api/response";
import {confirmTwoFactorSetup} from "@/server/services/two-factor-service";
export async function POST(req:Request){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();return dataResponse(await confirmTwoFactorSetup(u.id,await req.json().catch(()=>({}))));}catch(e){return errorResponse(e);}}
