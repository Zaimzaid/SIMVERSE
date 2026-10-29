import {z} from "zod";
import {AuthenticationError,ConflictError,ValidationError} from "@/lib/errors";
import {prisma} from "@/server/db/client";
import {verifyPassword} from "@/server/auth/password";
import {recordAudit} from "./audit-service";
export async function createAccountExport(userId:string) {
 const [user,identity,memberships,projects,assets,worlds,simulations,messages,socialConnections]=await Promise.all([
  prisma.user.findUniqueOrThrow({where:{id:userId},select:{id:true,email:true,displayName:true,avatarUrl:true,
   socialAlertsEnabled:true,twoFactorEnabledAt:true,emailVerifiedAt:true,createdAt:true,updatedAt:true}}),
  prisma.playerIdentity.findUnique({where:{userId}}),
  prisma.workspaceMember.findMany({where:{userId},select:{role:true,createdAt:true,workspace:{select:{id:true,name:true,ownerId:true}}}}),
  prisma.project.findMany({where:{createdById:userId},select:{id:true,name:true,workspaceId:true,status:true,createdAt:true,updatedAt:true}}),
  prisma.asset.findMany({where:{createdById:userId},select:{id:true,name:true,workspaceId:true,type:true,createdAt:true}}),
  prisma.world.findMany({where:{createdById:userId},select:{id:true,name:true,workspaceId:true,createdAt:true}}),
  prisma.simulation.findMany({where:{createdById:userId},select:{id:true,name:true,workspaceId:true,projectId:true,createdAt:true}}),
  prisma.socialMessage.findMany({where:{OR:[{senderId:userId},{recipientId:userId}]},orderBy:{createdAt:"asc"},
   select:{id:true,senderId:true,recipientId:true,body:true,mediaUrl:true,createdAt:true,readAt:true}}),
  prisma.socialFriendship.findMany({where:{OR:[{senderId:userId},{receiverId:userId}]},
   select:{id:true,senderId:true,receiverId:true,status:true,createdAt:true}}),
 ]);
 await recordAudit({action:"account.data_exported",actorUserId:userId});
 return {format:"simverse-account-snapshot-v1",exportedAt:new Date().toISOString(),
  coverage:"Account identity, workspace membership, authored project/world/asset/simulation summaries, direct messages and friendships; NOT full workspace content or all SIMVERSE activity.",
  account:user,playerIdentity:identity,workspaceMemberships:memberships,projects,assets,worlds,simulations,messages,socialConnections};
}
export async function getAccountDeletionRequest(userId:string){
 return prisma.accountDeletionRequest.findUnique({where:{userId},select:{status:true,requestedAt:true,cancelledAt:true}});
}
export async function requestAccountDeletion(userId:string,input:unknown){
 const parsed=z.object({password:z.string().min(1),confirmation:z.literal("DELETE MY ACCOUNT"),
   reason:z.string().trim().max(500).optional()}).strict().safeParse(input);
 if(!parsed.success)throw new ValidationError('Enter your password and type DELETE MY ACCOUNT exactly.');
 const account=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{passwordHash:true}});
 if(!await verifyPassword(parsed.data.password,account.passwordHash))throw new AuthenticationError("Incorrect password.");
 const existing=await prisma.accountDeletionRequest.findUnique({where:{userId}});
 if(existing?.status==="PENDING")throw new ConflictError("Your deletion request is already pending.");
 const row=await prisma.accountDeletionRequest.upsert({where:{userId},
  create:{userId,status:"PENDING",reason:parsed.data.reason??null},
  update:{status:"PENDING",reason:parsed.data.reason??null,requestedAt:new Date(),cancelledAt:null},
  select:{status:true,requestedAt:true}});
 await recordAudit({action:"account.deletion_requested",actorUserId:userId});
 return row;
}
export async function cancelAccountDeletion(userId:string){
 const updated=await prisma.accountDeletionRequest.updateMany({where:{userId,status:"PENDING"},
   data:{status:"CANCELLED",cancelledAt:new Date()}});
 if(!updated.count)throw new ConflictError("No pending deletion request exists.");
 await recordAudit({action:"account.deletion_cancelled",actorUserId:userId});
}
