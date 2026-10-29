import {z} from "zod";
import {AuthenticationError,NotFoundError,ValidationError} from "@/lib/errors";
import {prisma} from "@/server/db/client";
import {getCurrentSessionId} from "@/server/auth/session";
import {hashPassword,verifyPassword} from "@/server/auth/password";
import {recordAudit} from "./audit-service";
const changeSchema=z.object({
 currentPassword:z.string().min(1),newPassword:z.string().min(8).max(200).regex(/[A-Za-z]/).regex(/[0-9]/),
 confirmPassword:z.string().min(1),
}).strict();
async function currentSession(){const id=await getCurrentSessionId();if(!id)throw new AuthenticationError("Please sign in again.");return id;}
export async function changeAccountPassword(userId:string,input:unknown){
 const parsed=changeSchema.safeParse(input);
 if(!parsed.success || parsed.data.newPassword!==parsed.data.confirmPassword)
  throw new ValidationError("Check your current password, new password (8+ characters including a letter and number), and confirmation.");
 const {currentPassword,newPassword}=parsed.data;
 const user=await prisma.user.findUnique({where:{id:userId},select:{passwordHash:true}});
 if(!user || !await verifyPassword(currentPassword,user.passwordHash))
  throw new AuthenticationError("Current password is incorrect.");
 if(await verifyPassword(newPassword,user.passwordHash)) throw new ValidationError("Choose a different password.");
 const sessionId=await currentSession();
 const passwordHash=await hashPassword(newPassword);
 await prisma.$transaction([
  prisma.user.update({where:{id:userId},data:{passwordHash}}),
  prisma.session.deleteMany({where:{userId,id:{not:sessionId}}}),
 ]);
 await recordAudit({action:"account.password_changed",actorUserId:userId});
}
export async function listAccountSessions(userId:string){
 const id=await currentSession();
 const sessions=await prisma.session.findMany({where:{userId,expiresAt:{gt:new Date()}},
  orderBy:{createdAt:"desc"},take:40,select:{id:true,userAgent:true,ipAddress:true,createdAt:true,expiresAt:true}});
 return sessions.map(s=>({...s,current:s.id===id}));
}
export async function revokeAccountSession(userId:string,sessionId:string){
 const active=await currentSession();
 if(sessionId===active)throw new ValidationError("Use Log out to end this session.");
 const removed=await prisma.session.deleteMany({where:{id:sessionId,userId}});
 if(!removed.count) throw new NotFoundError("Session not found.");
 await recordAudit({action:"account.sessions_revoked",actorUserId:userId});
}
export async function revokeOtherAccountSessions(userId:string){
 const active=await currentSession();
 await prisma.session.deleteMany({where:{userId,id:{not:active}}});
 await recordAudit({action:"account.sessions_revoked",actorUserId:userId});
}
export async function getAccountPreferences(userId:string){
 return prisma.user.findUniqueOrThrow({where:{id:userId},select:{socialAlertsEnabled:true}});
}
export async function updateAccountPreferences(userId:string,input:unknown){
 const parsed=z.object({socialAlertsEnabled:z.boolean()}).strict().safeParse(input);
 if(!parsed.success)throw new ValidationError("Choose a valid notification setting.");
 const result=await prisma.user.update({where:{id:userId},data:parsed.data,select:{socialAlertsEnabled:true}});
 await recordAudit({action:"account.settings_updated",actorUserId:userId});
 return result;
}
