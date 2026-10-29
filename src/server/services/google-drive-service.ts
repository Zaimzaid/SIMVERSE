import {randomBytes,createHash,createCipheriv,createDecipheriv} from "node:crypto";
import {env} from "@/lib/env";
import {AuthenticationError,ConflictError,ValidationError} from "@/lib/errors";
import {getCurrentSessionId} from "@/server/auth/session";
import {prisma} from "@/server/db/client";
import {createAccountExport} from "./account-data-service";
const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";
const oauthKey=createHash("sha256").update(env.SESSION_SECRET+":google-drive-oauth:v1").digest();
const digest=(v:string)=>createHash("sha256").update(v).digest("hex");
function encrypt(value:string){
 const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",oauthKey,iv);
 const ct=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return [iv,cipher.getAuthTag(),ct].map(b=>b.toString("base64url")).join(".");
}
function decrypt(value:string){
 const [v,t,c]=value.split(".");
 if(!v||!t||!c)throw new ConflictError("Invalid stored connection; reconnect Google Drive.");
 const decipher=createDecipheriv("aes-256-gcm",oauthKey,Buffer.from(v,"base64url"));
 decipher.setAuthTag(Buffer.from(t,"base64url"));
 return Buffer.concat([decipher.update(Buffer.from(c,"base64url")),decipher.final()]).toString("utf8");
}
function config(){
 const id=process.env.GOOGLE_DRIVE_CLIENT_ID,secret=process.env.GOOGLE_DRIVE_CLIENT_SECRET;
 if(!id||!secret)throw new ConflictError("Google Drive backup is not configured.");
 if(env.NODE_ENV==="production"&&!env.APP_URL.startsWith("https://"))throw new ConflictError("An HTTPS APP_URL is required.");
 return {id,secret,redirectUri:env.APP_URL.replace(/\/$/,"")+"/api/account/cloud/google/callback"};
}
export function googleDriveAvailable() {
 return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET);
}
export async function googleDriveStatus(userId:string){
 return {configured:googleDriveAvailable(),connected:Boolean(await prisma.googleDriveConnection.findUnique({where:{userId},select:{id:true}}))};
}
export async function beginGoogleDriveOAuth(userId:string) {
 const cfg=config();const sessionId=await getCurrentSessionId();
 if(!sessionId)throw new AuthenticationError("Please sign in again.");
 const state=randomBytes(32).toString("base64url");
 await prisma.cloudOauthState.deleteMany({where:{userId}});
 await prisma.cloudOauthState.create({data:{userId,sessionId,stateHash:digest(state),expiresAt:new Date(Date.now()+10*60_000)}});
 const params=new URLSearchParams({
  client_id:cfg.id,redirect_uri:cfg.redirectUri,response_type:"code",scope:DRIVE_SCOPE,
  access_type:"offline",prompt:"consent",state,
 });
 return "https://accounts.google.com/o/oauth2/v2/auth?"+params.toString();
}
export async function finishGoogleDriveOAuth(userId:string,state:string,code:string) {
 const cfg=config();const sessionId=await getCurrentSessionId();
 if(!sessionId)throw new AuthenticationError("Your login session has expired.");
 if(!/^[A-Za-z0-9_-]{40,60}$/.test(state)||!code||code.length>4096)throw new ValidationError("Invalid Google authorization response.");
 const entry=await prisma.cloudOauthState.findUnique({where:{stateHash:digest(state)}});
 if(!entry||entry.userId!==userId||entry.sessionId!==sessionId||entry.expiresAt<=new Date())
  throw new AuthenticationError("The Google connection request expired. Try connecting again.");
 const used=await prisma.cloudOauthState.deleteMany({where:{id:entry.id,expiresAt:{gt:new Date()}}});
 if(!used.count)throw new AuthenticationError("The Google connection request was already used.");
 const form=new URLSearchParams({
  code,client_id:cfg.id,client_secret:cfg.secret,
  redirect_uri:cfg.redirectUri,grant_type:"authorization_code",
 });
 const response=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:form.toString(),signal:AbortSignal.timeout(10000),
 });
 if(!response.ok)throw new ConflictError("Google rejected the connection. Try again.");
 const data=await response.json() as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string};
 if(!data.access_token||!data.scope?.split(" ").includes(DRIVE_SCOPE))
  throw new ConflictError("Google Drive permission was not granted.");
 const existing=await prisma.googleDriveConnection.findUnique({where:{userId},select:{encryptedRefreshToken:true}});
 const refresh=data.refresh_token|| (existing?decrypt(existing.encryptedRefreshToken):null);
 if(!refresh)throw new ConflictError("Google did not issue offline access. Disconnect and reconnect.");
 const expiresAt=new Date(Date.now()+Math.max(60,Math.min(3600,Number(data.expires_in)||3600))*1000);
 await prisma.googleDriveConnection.upsert({where:{userId},create:{
  userId,encryptedAccessToken:encrypt(data.access_token),encryptedRefreshToken:encrypt(refresh),expiresAt,
 },update:{encryptedAccessToken:encrypt(data.access_token),encryptedRefreshToken:encrypt(refresh),expiresAt}});
}
async function token(userId:string) {
 const cfg=config();
 const connection=await prisma.googleDriveConnection.findUnique({where:{userId}});
 if(!connection)throw new ConflictError("Connect Google Drive first.");
 if(connection.expiresAt.getTime()>Date.now()+60000)return decrypt(connection.encryptedAccessToken);
 const response=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({client_id:cfg.id,client_secret:cfg.secret,
   refresh_token:decrypt(connection.encryptedRefreshToken),grant_type:"refresh_token"}).toString(),
  signal:AbortSignal.timeout(10000),
 });
 if(!response.ok)throw new ConflictError("Google Drive access expired. Please disconnect and reconnect.");
 const data=await response.json() as {access_token?:string;expires_in?:number};
 if(!data.access_token)throw new ConflictError("Could not refresh Google Drive access.");
 await prisma.googleDriveConnection.update({where:{userId},data:{
  encryptedAccessToken:encrypt(data.access_token),
  expiresAt:new Date(Date.now()+Math.max(60,Math.min(3600,Number(data.expires_in)||3600))*1000),
 }});
 return data.access_token;
}
export async function backupAccountSnapshotToGoogleDrive(userId:string) {
 const accessToken=await token(userId);
 const snapshot=await createAccountExport(userId);
 const payload=JSON.stringify(snapshot,null,2);
 // Google Drive multipart upload is intended for small files (<5 MB).
 if(Buffer.byteLength(payload,"utf8")>4_000_000)throw new ValidationError("Account snapshot exceeds 4 MB. Download it instead.");
 const name=`simverse-account-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
 const boundary="simverse_"+randomBytes(14).toString("hex");
 const body=new Blob([
  `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
  JSON.stringify({name,mimeType:"application/json"}),
  `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
  payload,`\r\n--${boundary}--`,
 ]);
 const response=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",{
  method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":`multipart/related; boundary=${boundary}`},
  body,signal:AbortSignal.timeout(30000),
 });
 if(!response.ok)throw new ConflictError("Google Drive backup failed. Check your connection and try again.");
 const data=await response.json() as {id?:string;name?:string};
 if(!data.id||!/^[A-Za-z0-9_-]{8,200}$/.test(data.id))throw new ConflictError("Google did not return a valid file ID.");
 await prisma.googleDriveConnection.update({where:{userId},data:{lastBackupAt:new Date()}});
 return {name:data.name||name,url:`https://drive.google.com/file/d/${data.id}/view`};
}
export async function disconnectGoogleDrive(userId:string){
 const connection=await prisma.googleDriveConnection.findUnique({where:{userId}});
 if(!connection)return;
 await prisma.googleDriveConnection.delete({where:{userId}});
 // Best-effort revocation after local credentials are irreversibly removed.
 try{await fetch("https://oauth2.googleapis.com/revoke",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({token:decrypt(connection.encryptedRefreshToken)}).toString(),
  signal:AbortSignal.timeout(6000),
 });}catch{/* Already disconnected locally. */}
}
