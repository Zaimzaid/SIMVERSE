import { AuthenticationError,ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse,errorResponse } from "@/server/api/response";
import { groupMessages,sendGroupMessage } from "@/server/services/social-advanced-service";
export async function GET(req:Request){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();const groupId=new URL(req.url).searchParams.get("groupId");if(!groupId||groupId.length>80)throw new ValidationError("Choose a group.");const before=new URL(req.url).searchParams.get("before");if(before!==null&&(!before||before.length>80))throw new ValidationError("Invalid message cursor.");return dataResponse({messages:await groupMessages(u.id,groupId,before??undefined)})}catch(e){return errorResponse(e)}}
export async function POST(req:Request){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();return dataResponse({message:await sendGroupMessage(u.id,await req.json().catch(()=>({})))},201)}catch(e){return errorResponse(e)}}
