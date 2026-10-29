import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";
import {env} from "@/lib/env";
import {AuthenticationError,ValidationError} from "@/lib/errors";
import {getSessionUser} from "@/server/auth/session";
import {errorResponse} from "@/server/api/response";
import {finishGoogleDriveOAuth} from "@/server/services/google-drive-service";
export async function GET(req:NextRequest) {
 try{
  const user=await getSessionUser();if(!user)throw new AuthenticationError();
  const error=req.nextUrl.searchParams.get("error");
  if(error)throw new ValidationError("Google connection was cancelled or denied.");
  const state=req.nextUrl.searchParams.get("state")||"";
  const code=req.nextUrl.searchParams.get("code")||"";
  await finishGoogleDriveOAuth(user.id,state,code);
  return NextResponse.redirect(new URL("/settings",env.APP_URL));
 }catch(e){return errorResponse(e);}
}
