import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse,errorResponse } from "@/server/api/response";
import { notifications,readNotifications } from "@/server/services/social-advanced-service";
export async function GET(){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();return dataResponse(await notifications(u.id))}catch(e){return errorResponse(e)}}
export async function PATCH(){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();await readNotifications(u.id);return dataResponse({success:true})}catch(e){return errorResponse(e)}}
