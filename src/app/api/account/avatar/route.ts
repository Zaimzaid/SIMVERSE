import {AuthenticationError,ValidationError} from "@/lib/errors";
import {getSessionUser} from "@/server/auth/session";
import {dataResponse,errorResponse} from "@/server/api/response";
import {saveUserAvatar} from "@/server/services/uploaded-image-service";
export async function POST(req:Request){
 try{const user=await getSessionUser();if(!user)throw new AuthenticationError("Sign in to upload an avatar.");
  if(Number(req.headers.get("content-length")||0)>900_000)throw new ValidationError("Image upload is too large.");
  const form=await req.formData();const image=form.get("image");
  if(!(image instanceof File))throw new ValidationError("Select a PNG, JPEG or WebP file.");
  const content=new Uint8Array(await image.arrayBuffer());
  return dataResponse(await saveUserAvatar(user.id,content,image.type));
 }catch(e){return errorResponse(e);}
}
