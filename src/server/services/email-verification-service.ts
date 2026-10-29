import {createHmac,randomBytes} from "node:crypto";
import {prisma} from "@/server/db/client";
import {env} from "@/lib/env";
import {AuthenticationError,ConflictError,NotFoundError} from "@/lib/errors";
import {recordAudit} from "./audit-service";
const hash=(token:string)=>createHmac("sha256",env.SESSION_SECRET).update("verify-email:"+token).digest("hex");
const ttl=24*60*60*1000;
export function verificationEnabled() { return process.env.SIMVERSE_REQUIRE_EMAIL_VERIFICATION === "true"; }
export function mailConfigured() {return Boolean(process.env.RESEND_API_KEY && process.env.SIMVERSE_INVITE_FROM);}
async function sendMail(email:string,link:string){
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.RESEND_API_KEY}`},
  body:JSON.stringify({from:process.env.SIMVERSE_INVITE_FROM,to:[email],subject:"Verify your SIMVERSE email",
   text:`Verify your SIMVERSE email by opening this single-use link (valid for 24 hours): ${link}\nIf you did not register, ignore this message.`}),
  signal:AbortSignal.timeout(10000),
 });
 if(!response.ok)throw new ConflictError("Could not send verification email. Please try again.");
}
export async function issueEmailVerification(userId:string,{ignoreRateLimit=false}:{ignoreRateLimit?:boolean}={}){
 if(!mailConfigured())throw new ConflictError("Email verification is temporarily unavailable. Ask an administrator to configure email delivery.");
 const user=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{email:true,emailVerifiedAt:true,emailVerificationRequired:true}});
 if(!user.emailVerificationRequired||user.emailVerifiedAt)return;
 const previous=await prisma.emailVerificationToken.findFirst({where:{userId},orderBy:{createdAt:"desc"}});
 if(previous&&!ignoreRateLimit && Date.now()-previous.createdAt.getTime()<60_000)return;
 const token=randomBytes(32).toString("base64url");
 await prisma.emailVerificationToken.deleteMany({where:{userId}});
 await prisma.emailVerificationToken.create({data:{userId,tokenHash:hash(token),expiresAt:new Date(Date.now()+ttl)}});
 const link=`${env.APP_URL.replace(/\/$/,"")}/verify-email?token=${encodeURIComponent(token)}`;
 await sendMail(user.email,link);
}
export async function verifyEmailToken(token:string){
 if(!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new NotFoundError("Invalid or expired verification link.");
 const record=await prisma.emailVerificationToken.findUnique({where:{tokenHash:hash(token)}});
 if(!record || record.expiresAt<=new Date())throw new NotFoundError("Invalid or expired verification link.");
 await prisma.$transaction(async tx=>{
  const deleted=await tx.emailVerificationToken.deleteMany({where:{id:record.id,expiresAt:{gt:new Date()}}});
  if(!deleted.count)throw new NotFoundError("Verification link already used.");
  await tx.user.update({where:{id:record.userId},data:{emailVerifiedAt:new Date()}});
  await tx.emailVerificationToken.deleteMany({where:{userId:record.userId}});
 });
 await recordAudit({action:"account.email_verified",actorUserId:record.userId});
}
export async function resendEmailVerification(email:string){
 const normalized=email.trim().toLowerCase();
 // Uniform success for unknown, verified or optional-verification accounts.
 const user=await prisma.user.findUnique({where:{email:normalized},select:{id:true,emailVerificationRequired:true,emailVerifiedAt:true}});
 if(user?.emailVerificationRequired&&!user.emailVerifiedAt)await issueEmailVerification(user.id);
}
