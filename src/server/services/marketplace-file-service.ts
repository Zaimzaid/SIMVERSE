import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { inspectMarketGlb, marketPrivateReference, MAX_MARKET_GLB_BYTES } from "@/lib/marketplace/glb-validation";
import { prisma } from "@/server/db/client";
import { requireMembership } from "@/server/services/workspace-service";
import { getAsset, updateAsset } from "@/server/services/asset-service";

const MAX_FORM_BYTES = MAX_MARKET_GLB_BYTES + 1024*1024;
export { MAX_FORM_BYTES };

function storePath(fileId:string) {
  const root=process.env.SIMVERSE_MARKETPLACE_STORAGE_DIR;
  if(!root || !isAbsolute(root))throw new ConflictError("Private 3D storage is not configured. Set an absolute persistent storage directory.");
  return join(resolve(root),fileId+".glb");
}
async function checkFilePermission(userId:string,fileId:string) {
  const item=await prisma.marketUploadedFile.findFirst({where:{id:fileId,status:"PRIVATE"}});
  if(!item)throw new NotFoundError("3D asset is unavailable.");
  if(item.uploaderId===userId) {
    await requireMembership(userId,item.workspaceId,"asset.view");
    return item;
  }
  const membership=await prisma.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId:item.workspaceId,userId}}});
  if(membership) {
    await requireMembership(userId,item.workspaceId,"asset.view");
    return item;
  }
  const mod=await prisma.marketModeratorGrant.findUnique({where:{userId}});
  if(mod?.isActive)return item;
  // A buyer must own the exact pinned asset version pointing to this file.
  const version=await prisma.assetVersion.findFirst({
    where:{assetId:item.assetId,externalReference:marketPrivateReference(fileId)},
    select:{version:true},
  });
  if(version){
    const entitlement=await prisma.marketEntitlement.findFirst({where:{
      userId,assetId:item.assetId,assetVersion:version.version,status:"ACTIVE",
    }});
    if(entitlement)return item;
  }
  throw new NotFoundError("3D asset is unavailable.");
}

/** Self-contained GLB pilot: private, persistent mounted directory only. */
export async function uploadMarketGlb(userId:string,workspaceId:string,assetId:string,file:File) {
  await requireMembership(userId,workspaceId,"asset.manage");
  const asset=await getAsset(userId,workspaceId,assetId);
  if(asset.status==="ARCHIVED")throw new ConflictError("Restore the asset before uploading.");
  if(asset.version.provenance.kind!=="ORIGINAL")throw new AuthorizationError("Only original creator assets can be uploaded.");
  if(!["MODEL_3D","ENVIRONMENT","PROP","CHARACTER","CREATURE","VEHICLE"].includes(asset.type))
    throw new ValidationError("Choose a 3D-compatible asset.");
  if(!file.name.toLowerCase().endsWith(".glb") || file.size>MAX_MARKET_GLB_BYTES || file.size<20)
    throw new ValidationError("Choose a self-contained GLB up to 20 MB.");
  const raw=new Uint8Array(await file.arrayBuffer());
  try{inspectMarketGlb(raw);}catch(e){throw new ValidationError(e instanceof Error?e.message:"Invalid GLB.");}
  const id=randomUUID().replaceAll("-","");
  const target=storePath(id);
  await mkdir(resolve(target,".."),{recursive:true,mode:0o700});
  try{await writeFile(target,raw,{flag:"wx",mode:0o600});}catch{
    throw new ConflictError("Private storage is unavailable. The asset was not changed.");
  }
  const hash=createHash("sha256").update(raw).digest("hex");
  let fileRowCreated=false;
  try{
    await prisma.marketUploadedFile.create({data:{
      id,uploaderId:userId,workspaceId,assetId,originalName:file.name.slice(0,180),
      byteSize:raw.length,sha256:hash,status:"PRIVATE",
    }});
    fileRowCreated=true;
    const updated=await updateAsset(userId,workspaceId,assetId,{
      externalReference:marketPrivateReference(id),
      modelSpecification:{...(asset.version.modelSpecification??{format:"GLB"}),format:"GLB"},
      changeNote:"Private GLB upload. Review before publishing.",
    });
    await prisma.marketUploadedFile.update({where:{id},data:{assetVersion:updated.currentVersion}});
    return {id,assetId,assetVersion:updated.currentVersion,byteSize:raw.length,sha256:hash};
  }catch(error){
    if(fileRowCreated)await prisma.marketUploadedFile.deleteMany({where:{id,assetVersion:null}}).catch(()=>{});
    await unlink(target).catch(()=>{});
    throw error;
  }
}

/** Never stream an unlicensed model: this verifies owner, moderator or buyer rights. */
export async function readAuthorizedMarketGlb(userId:string,fileId:string) {
  if(!/^[a-f0-9]{32}$/.test(fileId))throw new NotFoundError();
  const item=await checkFilePermission(userId,fileId);
  const source=await readFile(storePath(fileId)).catch(()=>{throw new NotFoundError("The file is not available on this server.");});
  if(source.byteLength!==item.byteSize || createHash("sha256").update(source).digest("hex")!==item.sha256)
    throw new ConflictError("The stored model failed its integrity check.");
  return source;
}
