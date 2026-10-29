import { z } from "zod";
import { prisma } from "@/server/db/client";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
const friendshipKey=(a:string,b:string)=>[a,b].sort().join(":");

export const mediaUrlSchema = z.string().url().max(2048).refine(url => {
  try { const u = new URL(url); return u.protocol === "https:" && !u.username && !u.password &&
    !/^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|\[::1\])$/i.test(u.hostname) &&
    /\.(png|jpg|jpeg|gif|webp|mp4|webm)$/i.test(u.pathname); } catch { return false; }
}, "Share a public HTTPS link ending in png, jpg, webp, gif, mp4 or webm.");
const groupSchema = z.object({ title:z.string().trim().min(2).max(65), invitees:z.array(z.string().min(1).max(80)).min(1).max(10) }).strict();
const groupTextSchema = z.object({groupId:z.string().min(1).max(80),body:z.string().trim().max(1500).default(""),
  mediaUrl:mediaUrlSchema.optional()}).strict().refine(x=>Boolean(x.body||x.mediaUrl),"Add text or a media link.");
const emojiSchema = z.enum(["👍","❤️","😂","😮","👏","🔥"]);

async function connected(a:string,b:string) {
  if(a===b) return true;
  const [friend, block] = await Promise.all([
    prisma.socialFriendship.findUnique({where:{pairKey:friendshipKey(a,b)}}),
    prisma.socialBlock.findFirst({where:{OR:[{blockerId:a,blockedId:b},{blockerId:b,blockedId:a}]}}),
  ]);
  return friend?.status === "ACCEPTED" && !block;
}
async function active(userId:string,groupId:string) {
  const m=await prisma.socialGroupMember.findUnique({where:{groupId_userId:{groupId,userId}}});
  if(m?.status!=="ACTIVE") throw new NotFoundError("Group not found or invitation not accepted.");
  return m;
}
async function notify(userId:string,kind:string,title:string,detail:string,href="/social") {
  const enabled=await prisma.user.findUnique({where:{id:userId},select:{socialAlertsEnabled:true}});
  if(!enabled?.socialAlertsEnabled)return;
  await prisma.socialNotification.create({data:{userId,kind,title,detail:detail.slice(0,180),href}});
}
export async function createSocialGroup(userId:string,payload:unknown) {
  const parsed=groupSchema.safeParse(payload);
  if(!parsed.success)throw new ValidationError("Enter a group name and 1–10 accepted friends.");
  const {title,invitees}=parsed.data;
  if(new Set(invitees).size!==invitees.length || invitees.includes(userId))throw new ValidationError("Invite distinct other players.");
  for(const peer of invitees)if(!await connected(userId,peer))
    throw new AuthorizationError("Only your accepted, unblocked friends can be invited.");
  const group=await prisma.socialGroup.create({
    data:{title,ownerId:userId,members:{create:[
      {userId,role:"OWNER",status:"ACTIVE",joinedAt:new Date()},
      ...invitees.map(id=>({userId:id,role:"MEMBER",status:"INVITED"})),
    ]}},select:{id:true,title:true},
  });
  for(const peer of invitees) await notify(peer,"GROUP_INVITE","Group invitation",`You were invited to ${title}`);
  return group;
}
export async function listSocialGroups(userId:string) {
  const memberships=await prisma.socialGroupMember.findMany({
    where:{userId},include:{group:{select:{id:true,title:true,ownerId:true,updatedAt:true,_count:{select:{members:true}}}}},
    orderBy:{createdAt:"desc"},take:100,
  });
  return memberships.map(m=>({...m.group,role:m.role,status:m.status}));
}
export async function respondGroupInvite(userId:string,groupId:string,action:"ACCEPT"|"LEAVE") {
  const membership=await prisma.socialGroupMember.findUnique({where:{groupId_userId:{groupId,userId}}});
  if(!membership)throw new NotFoundError("Invitation not found.");
  if(action==="LEAVE"){
    if(membership.role==="OWNER") throw new ValidationError("Owner cannot leave this group in V2.");
    await prisma.socialGroupMember.delete({where:{groupId_userId:{groupId,userId}}});return;
  }
  if(membership.status!=="INVITED")throw new ConflictError("Invitation has already been resolved.");
  // Do not join if the original inviter is no longer a friend.
  const owner=await prisma.socialGroup.findUnique({where:{id:groupId},select:{ownerId:true}});
  if(!owner || !await connected(userId,owner.ownerId))throw new AuthorizationError("Group invite is no longer eligible.");
  await prisma.socialGroupMember.update({
    where:{groupId_userId:{groupId,userId}},data:{status:"ACTIVE",joinedAt:new Date()},
  });
}
export async function groupMessages(userId:string,groupId:string) {
  await active(userId,groupId);
  const blocks=await prisma.socialBlock.findMany({
    where:{OR:[{blockerId:userId},{blockedId:userId}]},select:{blockerId:true,blockedId:true},
  });
  const blocked=new Set(blocks.map(b=>b.blockerId===userId?b.blockedId:b.blockerId));
  const rows=await prisma.socialGroupMessage.findMany({
    where:{groupId,senderId:{notIn:[...blocked]}},orderBy:{createdAt:"desc"},take:100,
    select:{id:true,groupId:true,senderId:true,body:true,mediaUrl:true,createdAt:true,
      sender:{select:{displayName:true}},reactions:{select:{emoji:true,actorId:true}}},
  });
  return rows.reverse();
}
export async function sendGroupMessage(userId:string,payload:unknown) {
  const parsed=groupTextSchema.safeParse(payload);
  if(!parsed.success)throw new ValidationError("Write text or enter a valid public HTTPS media link.");
  const {groupId,body,mediaUrl}=parsed.data;
  await active(userId,groupId);
  const last=await prisma.socialGroupMessage.count({where:{senderId:userId,createdAt:{gte:new Date(Date.now()-60000)}}});
  if(last>=20)throw new ValidationError("Group message rate limit reached.");
  const message=await prisma.socialGroupMessage.create({data:{groupId,senderId:userId,body,mediaUrl}});
  await prisma.socialGroup.update({where:{id:groupId},data:{updatedAt:new Date()}});
  const peers=await prisma.socialGroupMember.findMany({
    where:{groupId,status:"ACTIVE",userId:{not:userId}},select:{userId:true},
  });
  for(const p of peers) await notify(p.userId,"GROUP_MESSAGE","New group message","A group you joined has a new message.");
  return message;
}
export async function reactToMessage(userId:string,payload:unknown) {
  const schema=z.object({kind:z.enum(["DIRECT","GROUP"]),messageId:z.string().min(1).max(80),emoji:emojiSchema}).strict();
  const parsed=schema.safeParse(payload);
  if(!parsed.success)throw new ValidationError("Choose an allowed reaction.");
  const {kind,messageId,emoji}=parsed.data;
  if(kind==="DIRECT") {
    const msg=await prisma.socialMessage.findUnique({where:{id:messageId}});
    if(!msg || (msg.senderId!==userId&&msg.recipientId!==userId))throw new NotFoundError("Message not found.");
    if(!await connected(msg.senderId,msg.recipientId))throw new AuthorizationError("Friendship is required.");
    const key={actorId:userId,directMessageId:messageId,emoji};
    const existing=await prisma.socialReaction.findUnique({where:{actorId_directMessageId_emoji:key}});
    if(existing){await prisma.socialReaction.delete({where:{id:existing.id}});return {active:false};}
    await prisma.socialReaction.create({data:key});return {active:true};
  }
  const msg=await prisma.socialGroupMessage.findUnique({where:{id:messageId}});
  if(!msg)throw new NotFoundError("Message not found.");
  await active(userId,msg.groupId);
  const key={actorId:userId,groupMessageId:messageId,emoji};
  const existing=await prisma.socialReaction.findUnique({where:{actorId_groupMessageId_emoji:key}});
  if(existing){await prisma.socialReaction.delete({where:{id:existing.id}});return {active:false};}
  await prisma.socialReaction.create({data:key});return {active:true};
}
export async function notifications(userId:string) {
  const items=await prisma.socialNotification.findMany({
    where:{userId},orderBy:{createdAt:"desc"},take:60,
    select:{id:true,kind:true,title:true,detail:true,href:true,readAt:true,createdAt:true},
  });
  return {items,unread:items.filter(x=>!x.readAt).length};
}
export async function readNotifications(userId:string) {
  await prisma.socialNotification.updateMany({where:{userId,readAt:null},data:{readAt:new Date()}});
}
export async function recordFriendInvite(userId:string) {
  await notify(userId,"FRIEND_INVITE","Friend request","Someone invited you to connect on SIMVERSE.");
}
export async function recordFriendAccept(userId:string) {
  await notify(userId,"FRIEND_ACCEPTED","New friend","Your friendship request was accepted.");
}
export async function recordDirectMessage(userId:string) {
  await notify(userId,"MESSAGE","New message","A friend sent a message.");
}
export async function sendCallSignal(userId:string,payload:unknown) {
  const schema=z.object({receiverId:z.string().min(1).max(80),callId:z.string().uuid(),
    kind:z.enum(["OFFER","ANSWER","ICE","HANGUP"]),
    payload:z.string().max(16000)}).strict();
  const parsed=schema.safeParse(payload);
  if(!parsed.success)throw new ValidationError("Invalid call signal.");
  const {receiverId,callId,kind,payload:detail}=parsed.data;
  if(!await connected(userId,receiverId))throw new AuthorizationError("Calls require mutual friendship.");
  const recent=await prisma.socialCallSignal.count({where:{senderId:userId,createdAt:{gte:new Date(Date.now()-60000)}}});
  if(recent>=80)throw new ValidationError("Call signal rate limit reached.");
  if(kind!=="OFFER") {
    const first=await prisma.socialCallSignal.findFirst({where:{callId,kind:"OFFER",OR:[
      {senderId:userId,receiverId},{senderId:receiverId,receiverId:userId},
    ],createdAt:{gte:new Date(Date.now()-1000*60*10)}}});
    if(!first)throw new NotFoundError("Call has expired.");
  }else await notify(receiverId,"CALL","Incoming call","A friend is calling you.");
  return prisma.socialCallSignal.create({data:{senderId:userId,receiverId,callId,kind,payload:detail},
    select:{id:true,kind:true,createdAt:true}});
}
export async function receiveCallSignals(userId:string,after?:Date) {
  const maxAge=new Date(Date.now()-1000*60*10);
  const since=after&&after>maxAge?after:maxAge;
  const rows=await prisma.socialCallSignal.findMany({
    where:{receiverId:userId,createdAt:{gt:since}},orderBy:[{createdAt:"asc"},{id:"asc"}],take:100,
    select:{id:true,senderId:true,receiverId:true,callId:true,kind:true,payload:true,createdAt:true},
  });
  const approved=[];for(const row of rows){if(await connected(userId,row.senderId))approved.push(row);}
  return approved;
}
