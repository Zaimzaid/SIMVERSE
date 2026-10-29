import {ValidationError,AuthorizationError,NotFoundError} from "@/lib/errors";
import {prisma} from "@/server/db/client";
import {requireMembership} from "./workspace-service";
import {recordAudit} from "./audit-service";
const maxSize=600_000;
function detect(buffer:Uint8Array):string|null {
 if(buffer.length>8 && [137,80,78,71,13,10,26,10].every((n,i)=>buffer[i]===n))return "image/png";
 if(buffer.length>4 && buffer[0]===0xff && buffer[1]===0xd8 && buffer[2]===0xff)return "image/jpeg";
 if(buffer.length>12 && String.fromCharCode(...buffer.subarray(0,4))==="RIFF"
  && String.fromCharCode(...buffer.subarray(8,12))==="WEBP")return "image/webp";
 return null;
}
export function validateImageBytes(content:Uint8Array,declaredType:string) {
 if(content.length===0 || content.length>maxSize)throw new ValidationError("Image must be between 1 byte and 600 KB.");
 const mediaType=detect(content);
 if(!mediaType || declaredType!==mediaType)throw new ValidationError("Upload a PNG, JPEG or WebP image (not SVG or other formats).");
 return mediaType;
}
export async function saveUserAvatar(userId:string,content:Uint8Array,type:string) {
 const mediaType=validateImageBytes(content,type);
 const previous=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{avatarUrl:true}});
 const image=await prisma.$transaction(async tx=>{
  const row=await tx.uploadedImage.create({data:{uploadedById:userId,workspaceId:null,purpose:"AVATAR",mediaType,content:new Uint8Array(content)}});
  await tx.user.update({where:{id:userId},data:{avatarUrl:`/api/images/${row.id}`}});
  return row;
 });
 const old=previous.avatarUrl?.match(/^\/api\/images\/([a-z0-9]+)$/);
 if(old)await prisma.uploadedImage.deleteMany({where:{id:old[1],uploadedById:userId,purpose:"AVATAR"}});
 await recordAudit({action:"user.profile_updated",actorUserId:userId,entityType:"UploadedImage",entityId:image.id});
 return {url:`/api/images/${image.id}`};
}
export async function saveWorkspaceLogo(userId:string,workspaceId:string,content:Uint8Array,type:string) {
 await requireMembership(userId,workspaceId,"workspace.edit");
 const mediaType=validateImageBytes(content,type);
 const previous=await prisma.workspace.findUniqueOrThrow({where:{id:workspaceId},select:{logoUrl:true}});
 const image=await prisma.$transaction(async tx=>{
  const row=await tx.uploadedImage.create({data:{uploadedById:userId,workspaceId,purpose:"WORKSPACE_LOGO",mediaType,content:new Uint8Array(content)}});
  await tx.workspace.update({where:{id:workspaceId},data:{logoUrl:`/api/images/${row.id}`}});
  return row;
 });
 const old=previous.logoUrl?.match(/^\/api\/images\/([a-z0-9]+)$/);
 if(old)await prisma.uploadedImage.deleteMany({where:{id:old[1],workspaceId,purpose:"WORKSPACE_LOGO"}});
 await recordAudit({action:"workspace.updated",actorUserId:userId,workspaceId,entityType:"UploadedImage",entityId:image.id});
 return {url:`/api/images/${image.id}`};
}
export async function getUploadedImage(imageId:string) {
 if(!/^[a-z0-9]{10,40}$/.test(imageId))throw new NotFoundError();
 const img=await prisma.uploadedImage.findUnique({where:{id:imageId},select:{mediaType:true,content:true}});
 if(!img)throw new NotFoundError("Image not found.");
 // Only intended public identity images are stored here.
 return img;
}
