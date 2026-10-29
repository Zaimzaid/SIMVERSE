import {AuthenticationError} from "@/lib/errors";
import {getSessionUser} from "@/server/auth/session";
import {dataResponse,errorResponse} from "@/server/api/response";
import {disconnectGoogleDrive,googleDriveStatus} from "@/server/services/google-drive-service";
async function current(){const u=await getSessionUser();if(!u)throw new AuthenticationError();return u.id;}
export async function GET(){try{return dataResponse(await googleDriveStatus(await current()));}catch(e){return errorResponse(e);}}
export async function DELETE(){try{await disconnectGoogleDrive(await current());return dataResponse({ok:true});}catch(e){return errorResponse(e);}}
