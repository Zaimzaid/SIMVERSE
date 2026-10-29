import { getCurrentUser } from "@/server/context";
import { AuthenticationError } from "@/lib/errors";
import { errorResponse } from "@/server/api/response";
import { readAuthorizedMarketGlb } from "@/server/services/marketplace-file-service";
export const runtime="nodejs";
type Context={params:Promise<{fileId:string}>};
export async function GET(_request:Request,context:Context){
 try{
   const user=await getCurrentUser();
   if(!user)throw new AuthenticationError("Sign in to view this model.");
   const {fileId}=await context.params;
   const bytes=await readAuthorizedMarketGlb(user.id,fileId);
   return new Response(new Uint8Array(bytes),{
     headers:{
       "Content-Type":"model/gltf-binary",
       "Content-Disposition":"inline; filename=simverse-model.glb",
       "Cache-Control":"private, no-store, max-age=0",
       "X-Content-Type-Options":"nosniff",
       "X-Frame-Options":"DENY",
       "Cross-Origin-Resource-Policy":"same-origin",
     },
   });
 }catch(error){return errorResponse(error);}
}
