import type {NextRequest} from "next/server";
import {requireUser} from "@/server/context";
import {dataResponse,errorResponse} from "@/server/api/response";
import {changeAccountPassword} from "@/server/services/account-security-service";
export async function POST(req:NextRequest){
 try{const user=await requireUser();await changeAccountPassword(user.id,await req.json().catch(()=>({})));return dataResponse({ok:true});}catch(e){return errorResponse(e);}
}
