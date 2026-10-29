import {AuthenticationError} from "@/lib/errors";
import {getSessionUser} from "@/server/auth/session";
import {dataResponse,errorResponse} from "@/server/api/response";
import {backupAccountSnapshotToGoogleDrive} from "@/server/services/google-drive-service";
export async function POST(){try{const u=await getSessionUser();if(!u)throw new AuthenticationError();
 return dataResponse(await backupAccountSnapshotToGoogleDrive(u.id));}catch(e){return errorResponse(e);}}
