import {NextResponse} from "next/server";
import {AuthenticationError} from "@/lib/errors";
import {getSessionUser} from "@/server/auth/session";
import {errorResponse} from "@/server/api/response";
import {beginGoogleDriveOAuth} from "@/server/services/google-drive-service";
export async function GET() {
 try{const user=await getSessionUser();if(!user)throw new AuthenticationError();
  return NextResponse.redirect(await beginGoogleDriveOAuth(user.id));
 }catch(e){return errorResponse(e);}
}
