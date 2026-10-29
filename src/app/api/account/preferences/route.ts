import type {NextRequest} from "next/server";
import {requireUser} from "@/server/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {getAccountPreferences,updateAccountPreferences} from "@/server/services/account-security-service";
export async function GET(){try{const user=await requireUser();return dataResponse({preferences:await getAccountPreferences(user.id)});}catch(e){return errorResponse(e);}}
export async function PATCH(req:NextRequest){try{const user=await requireUser();return dataResponse({preferences:await updateAccountPreferences(user.id,await req.json().catch(()=>({})))})}catch(e){return errorResponse(e);}}
