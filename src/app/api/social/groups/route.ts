import { AuthenticationError,ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse,errorResponse } from "@/server/api/response";
import { createSocialGroup,listSocialGroups,respondGroupInvite } from "@/server/services/social-advanced-service";
export async function GET(){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();return dataResponse({groups:await listSocialGroups(u.id)})}catch(e){return errorResponse(e)}}
export async function POST(req:Request){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();return dataResponse({group:await createSocialGroup(u.id,await req.json().catch(()=>({})))},201)}catch(e){return errorResponse(e)}}
export async function PATCH(req:Request){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();const p=await req.json().catch(()=>({}));if(typeof p.id!=="string"||p.id.length>80||!["ACCEPT","LEAVE"].includes(p.action))throw new ValidationError("Invalid group action.");await respondGroupInvite(u.id,p.id,p.action);return dataResponse({success:true})}catch(e){return errorResponse(e)}}
