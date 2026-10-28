import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse,errorResponse } from "@/server/api/response";
import { reactToMessage } from "@/server/services/social-advanced-service";
export async function POST(req:Request){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();return dataResponse(await reactToMessage(u.id,await req.json().catch(()=>({}))))}catch(e){return errorResponse(e)}}
