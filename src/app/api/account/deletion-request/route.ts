import {getSessionUser} from "@/server/auth/session";
import {AuthenticationError} from "@/lib/errors";
import {errorResponse,dataResponse} from "@/server/api/response";
import {cancelAccountDeletion,getAccountDeletionRequest,requestAccountDeletion} from "@/server/services/account-data-service";
async function identity(){const user=await getSessionUser();if(!user)throw new AuthenticationError();return user.id;}
export async function GET(){try{return dataResponse({request:await getAccountDeletionRequest(await identity())});}catch(e){return errorResponse(e);}}
export async function POST(req:Request){try{return dataResponse({request:await requestAccountDeletion(await identity(),await req.json().catch(()=>({})))},201);}catch(e){return errorResponse(e);}}
export async function DELETE(){try{await cancelAccountDeletion(await identity());return dataResponse({ok:true});}catch(e){return errorResponse(e);}}
