import { AuthenticationError,ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse,errorResponse } from "@/server/api/response";
import { sendCallSignal,receiveCallSignals } from "@/server/services/social-advanced-service";
export async function GET(req:Request){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();const query=new URL(req.url).searchParams.get("after");const time=query?new Date(query):undefined;if(query&&(!time||!Number.isFinite(time.getTime())))throw new ValidationError("Invalid cursor.");return dataResponse({signals:await receiveCallSignals(u.id,time)})}catch(e){return errorResponse(e)}}
export async function POST(req:Request){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();return dataResponse({signal:await sendCallSignal(u.id,await req.json().catch(()=>({})))},201)}catch(e){return errorResponse(e)}}
