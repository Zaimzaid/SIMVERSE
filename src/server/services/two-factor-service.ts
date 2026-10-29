import {createHmac,randomBytes} from "node:crypto";
import { z } from "zod";
import {AuthenticationError,ConflictError,NotFoundError,ValidationError} from "@/lib/errors";
import {env} from "@/lib/env";
import {prisma} from "@/server/db/client";
import {verifyPassword} from "@/server/auth/password";
import {getCurrentSessionId} from "@/server/auth/session";
import {createTotpSecret,decryptSecret,encryptSecret,hashRecoveryCode,makeRecoveryCodes,verifyTotp} from "@/server/auth/totp";
import {recordAudit} from "./audit-service";
const tokenHash=(token:string)=>createHmac("sha256",env.SESSION_SECRET).update("challenge:"+token).digest("hex");
const MAX_ATTEMPTS=5;
export async function twoFactorStatus(userId:string) {
 const user=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{twoFactorEnabledAt:true}});
 return {enabled: Boolean(user.twoFactorEnabledAt)};
}
async function requirePassword(userId:string,password:string) {
 const user=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{passwordHash:true}});
 if(!await verifyPassword(password,user.passwordHash)) throw new AuthenticationError("Incorrect account password.");
}
export async function startTwoFactorSetup(userId:string,body:unknown) {
 const parsed=z.object({password:z.string().min(1)}).strict().safeParse(body);
 if(!parsed.success)throw new ValidationError("Confirm your current account password.");
 await requirePassword(userId,parsed.data.password);
 const account=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{email:true,twoFactorEnabledAt:true}});
 if(account.twoFactorEnabledAt)throw new ConflictError("Two-factor authentication is already enabled.");
 const secret=createTotpSecret();
 await prisma.user.update({where:{id:userId},data:{twoFactorPendingSecret:encryptSecret(secret),twoFactorPendingExpiresAt:new Date(Date.now()+15*60_000)}});
 return {secret,otpauthUrl:`otpauth://totp/SIMVERSE:${encodeURIComponent(account.email)}?secret=${secret}&issuer=SIMVERSE&algorithm=SHA1&digits=6&period=30`};
}
export async function confirmTwoFactorSetup(userId:string,body:unknown) {
 const parsed=z.object({code:z.string().regex(/^\d{6}$/)}).strict().safeParse(body);
 if(!parsed.success)throw new ValidationError("Enter the six-digit code from your authenticator.");
 const user=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{twoFactorPendingSecret:true,twoFactorPendingExpiresAt:true,twoFactorEnabledAt:true}});
 if(user.twoFactorEnabledAt)throw new ConflictError("Already enabled.");
 if(!user.twoFactorPendingSecret || !user.twoFactorPendingExpiresAt || user.twoFactorPendingExpiresAt<new Date())throw new NotFoundError("Setup expired. Start again.");
 if(!verifyTotp(decryptSecret(user.twoFactorPendingSecret),parsed.data.code))throw new AuthenticationError("Incorrect authenticator code.");
 const {codes,hashes}=makeRecoveryCodes(userId);
 const current=await getCurrentSessionId();
 if(!current)throw new AuthenticationError("Sign in again.");
 await prisma.$transaction([
  prisma.user.update({where:{id:userId},data:{twoFactorSecret:user.twoFactorPendingSecret,twoFactorPendingSecret:null,twoFactorPendingExpiresAt:null,twoFactorRecoveryHashes:JSON.stringify(hashes),twoFactorEnabledAt:new Date()}}),
  prisma.session.deleteMany({where:{userId,id:{not:current}}}),
 ]);
 await recordAudit({action:"account.two_factor_enabled",actorUserId:userId});
 return {recoveryCodes:codes};
}
export async function disableTwoFactor(userId:string,body:unknown){
 const parsed=z.object({password:z.string().min(1),code:z.string().min(1).max(30)}).strict().safeParse(body);
 if(!parsed.success)throw new ValidationError("Enter your password and authenticator/recovery code.");
 await requirePassword(userId,parsed.data.password);
 const account=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{twoFactorSecret:true,twoFactorEnabledAt:true,twoFactorRecoveryHashes:true}});
 if(!account.twoFactorEnabledAt || !account.twoFactorSecret)throw new ConflictError("Two-factor authentication is not enabled.");
 const code=parsed.data.code.trim();
 const recovery=JSON.parse(account.twoFactorRecoveryHashes||"[]") as string[];
 if(!verifyTotp(decryptSecret(account.twoFactorSecret),code)&&!recovery.includes(hashRecoveryCode(userId,code)))
   throw new AuthenticationError("Incorrect authenticator or recovery code.");
 const current=await getCurrentSessionId();
 if(!current)throw new AuthenticationError("Sign in again.");
 await prisma.$transaction([
   prisma.user.update({where:{id:userId},data:{twoFactorEnabledAt:null,twoFactorSecret:null,twoFactorPendingSecret:null,twoFactorPendingExpiresAt:null,twoFactorRecoveryHashes:null}}),
   prisma.session.deleteMany({where:{userId,id:{not:current}}}),
 ]);
 await recordAudit({action:"account.two_factor_disabled",actorUserId:userId});
}
export async function beginTwoFactorChallenge(userId:string){
 const token=randomBytes(32).toString("base64url");
 await prisma.twoFactorChallenge.deleteMany({where:{userId}});
 await prisma.twoFactorChallenge.create({data:{userId,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+5*60_000)}});
 return token;
}
export async function completeTwoFactorChallenge(body:unknown){
 const parsed=z.object({challenge:z.string().regex(/^[A-Za-z0-9_-]{40,60}$/),code:z.string().min(1).max(30)}).strict().safeParse(body);
 if(!parsed.success)throw new AuthenticationError("Invalid or expired challenge.");
 const challenge=await prisma.twoFactorChallenge.findUnique({where:{tokenHash:tokenHash(parsed.data.challenge)}});
 if(!challenge || challenge.expiresAt<=new Date() || challenge.attempts>=MAX_ATTEMPTS)
   throw new AuthenticationError("Invalid or expired challenge.");
 const claimed=await prisma.twoFactorChallenge.updateMany({where:{id:challenge.id,attempts:{lt:MAX_ATTEMPTS},expiresAt:{gt:new Date()}},data:{attempts:{increment:1}}});
 if(!claimed.count) throw new AuthenticationError("Challenge expired or locked.");
 const user=await prisma.user.findUnique({where:{id:challenge.userId},select:{twoFactorSecret:true,twoFactorEnabledAt:true,twoFactorRecoveryHashes:true}});
 if(!user?.twoFactorEnabledAt || !user.twoFactorSecret)throw new AuthenticationError("Invalid challenge.");
 const code=parsed.data.code.trim();
 const validTotp=verifyTotp(decryptSecret(user.twoFactorSecret),code);
 const hashes=JSON.parse(user.twoFactorRecoveryHashes||"[]") as string[];
 const recoveryHash=hashRecoveryCode(challenge.userId,code);
 const validRecovery=hashes.includes(recoveryHash);
 if(!validTotp && !validRecovery)throw new AuthenticationError("Incorrect code.");
 await prisma.$transaction(async tx=>{
   const consumed=await tx.twoFactorChallenge.deleteMany({where:{id:challenge.id}});
   if(!consumed.count)throw new ConflictError("Challenge already used.");
   if(validRecovery){
     const updated=await tx.user.updateMany({where:{id:challenge.userId,twoFactorRecoveryHashes:user.twoFactorRecoveryHashes},data:{twoFactorRecoveryHashes:JSON.stringify(hashes.filter(h=>h!==recoveryHash))}});
     if(!updated.count)throw new ConflictError("Recovery code was already used.");
   }
 });
 await recordAudit({action:"account.two_factor_login",actorUserId:challenge.userId});
 return challenge.userId;
}
