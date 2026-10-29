import {AuthenticationError,ValidationError} from "@/lib/errors";
import {getSessionUser} from "@/server/auth/session";
import {dataResponse,errorResponse} from "@/server/api/response";
import {saveWorkspaceLogo} from "@/server/services/uploaded-image-service";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{const user=await getSessionUser();if(!user)throw new AuthenticationError();
  const {id}=await params;if(Number(req.headers.get("content-length")||0)>900_000)throw new ValidationError("Image upload is too large.");
  const form=await req.formData();const image=form.get("image");
  if(!(image instanceof File))throw new ValidationError("Select a PNG, JPEG or WebP file.");
  return dataResponse(await saveWorkspaceLogo(user.id,id,new Uint8Array(await image.arrayBuffer()),image.type));
 }catch(e){return errorResponse(e);}
}
