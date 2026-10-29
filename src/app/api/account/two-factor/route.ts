import {getSessionUser} from "@/server/auth/session";
import {AuthenticationError} from "@/lib/errors";
import {dataResponse,errorResponse} from "@/server/api/response";
import {twoFactorStatus,disableTwoFactor} from "@/server/services/two-factor-service";
async function current(){const user=await getSessionUser();if(!user)throw new AuthenticationError("Sign in again.");return user.id;}
export async function GET(){try{return dataResponse(await twoFactorStatus(await current()));}catch(e){return errorResponse(e);}}
export async function DELETE(req:Request){try{await disableTwoFactor(await current(),await req.json().catch(()=>({})));return dataResponse({ok:true});}catch(e){return errorResponse(e);}}
