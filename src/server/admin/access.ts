import {createHmac,timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
import {AuthenticationError,AuthorizationError} from "@/lib/errors";
import {env,isProduction} from "@/lib/env";
import {getCurrentSessionId,getSessionUser} from "@/server/auth/session";
import {verifyTotp,decryptSecret} from "@/server/auth/totp";
import {prisma} from "@/server/db/client";
import {allowedAdminSections,isAdminRole,readDeniedAdminSections,type AdminRole,type AdminSection} from "@/lib/admin/permissions";
import {clearAdminTotpAttempts,takeAdminTotpAttempt} from "./totp-rate-limit";

export const ADMIN_STEPUP_COOKIE="kavandro_admin_verified";
const STEPUP_MINUTES=60;
function signature(userId:string,sessionId:string,expiry:number):string{
 return createHmac("sha256",env.SESSION_SECRET).update(["admin:stepup:v1",userId,sessionId,expiry].join(":")).digest("hex");
}
export function makeAdminStepupTicket(userId:string,sessionId:string,expiry:number):string{
 return String(expiry)+"."+signature(userId,sessionId,expiry);
}
export function validAdminStepupTicket(raw:string|undefined,userId:string,sessionId:string,now=Date.now()):boolean{
 if(!raw)return false;
 const [dateText,mac,...rest]=raw.split(".");
 if(rest.length || !dateText || !/^\d{13}$/.test(dateText) || !mac || !/^[0-9a-f]{64}$/.test(mac))return false;
 const expiry=Number(dateText);
 if(!Number.isSafeInteger(expiry)||expiry<=now||expiry>now+STEPUP_MINUTES*60_000)return false;
 const expected=signature(userId,sessionId,expiry);
 return timingSafeEqual(Buffer.from(mac,"hex"),Buffer.from(expected,"hex"));
}
export async function isAdminStepupValid(userId:string):Promise<boolean>{
 const sessionId=await getCurrentSessionId();
 if(!sessionId)return false;
 const ticket=(await cookies()).get(ADMIN_STEPUP_COOKIE)?.value;
 return validAdminStepupTicket(ticket,userId,sessionId);
}
export async function setAdminStepupCookie(userId:string):Promise<void>{
 const sessionId=await getCurrentSessionId();
 if(!sessionId)throw new AuthenticationError("Sign in again before opening the admin dashboard.");
 const expires=Date.now()+STEPUP_MINUTES*60_000;
 (await cookies()).set(ADMIN_STEPUP_COOKIE,makeAdminStepupTicket(userId,sessionId,expires),{
  httpOnly:true,secure:isProduction,sameSite:"strict",path:"/",expires:new Date(expires),
 });
}
export async function verifyAdminTotp(userId:string,code:unknown):Promise<void>{
 if(typeof code!=="string"||!/^\d{6}$/.test(code))throw new AuthenticationError("Enter the current six-digit authenticator code.");
 if(!takeAdminTotpAttempt(userId))throw new AuthenticationError("Too many attempts. Please try again in 15 minutes.");
 const user=await prisma.user.findUnique({where:{id:userId},select:{twoFactorSecret:true,twoFactorEnabledAt:true}});
 if(!user?.twoFactorSecret || !user.twoFactorEnabledAt)throw new AuthenticationError("Enable Google Authenticator-compatible two-factor authentication in account settings first.");
 const valid=verifyTotp(decryptSecret(user.twoFactorSecret),code);
 if(!valid){
  await prisma.auditLog.create({data:{actorUserId:userId,action:"platform_admin.code_rejected"}}).catch(()=>undefined);
  throw new AuthenticationError("Incorrect or expired authenticator code.");
 }
 clearAdminTotpAttempts(userId);
}
export async function getPlatformStaff(userId:string){
 try{
  return await prisma.platformAdmin.findUnique({where:{userId}});
 }catch(error){
  // Before the new admin tables are migrated, fail closed without crashing
  // every citizen dashboard. Admin access stays disabled until db:push.
  if(error && typeof error==="object" && "code" in error && error.code==="P2021")return null;
  throw error;
 }
}
export async function requireAdminAccess(section?:AdminSection){
 const user=await getSessionUser();
 if(!user)throw new AuthenticationError("Log in before accessing administration.");
 const staff=await getPlatformStaff(user.id);
 if(!staff?.active || !isAdminRole(staff.role))throw new AuthorizationError("You do not have platform administration access.");
 const enabled=await prisma.user.findUnique({where:{id:user.id},select:{twoFactorEnabledAt:true}});
 if(!enabled?.twoFactorEnabledAt)throw new AuthenticationError("Enable an authenticator before accessing administration.");
 if(!await isAdminStepupValid(user.id))throw new AuthenticationError("Enter your current authenticator code to unlock the admin dashboard.");
 const role=staff.role as AdminRole;
 const sections=allowedAdminSections(role,readDeniedAdminSections(staff.deniedSections));
 if(section&&!sections.includes(section))throw new AuthorizationError("This admin dashboard section is not included in your access.");
 return {user,staff,role,sections};
}
