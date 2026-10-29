import {getUploadedImage} from "@/server/services/uploaded-image-service";
import {errorResponse} from "@/server/api/response";
export async function GET(_req:Request,{params}:{params:Promise<{imageId:string}>}){
 try{const {imageId}=await params;const image=await getUploadedImage(imageId);
  return new Response(new Uint8Array(image.content),{headers:{"Content-Type":image.mediaType,
   "Content-Disposition":"inline","X-Content-Type-Options":"nosniff","Cache-Control":"public, max-age=31536000, immutable",
   "Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch(e){return errorResponse(e);}
}
