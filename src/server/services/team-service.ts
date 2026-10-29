import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { isWorkspaceRole, type WorkspaceRole } from "@/lib/permissions";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

const inviteInput = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(["ADMIN","CREATOR","OPERATOR","EDITOR","ANALYST","VIEWER"]),
});
const roleInput = z.object({ role: inviteInput.shape.role });
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const sevenDays = 7 * 24 * 60 * 60 * 1000;
export const TEAM_ROLES = ["ADMIN","CREATOR","OPERATOR","EDITOR","ANALYST","VIEWER"] as const;

async function manager(userId: string, workspaceId: string) {
  return requireMembership(userId, workspaceId, "workspace.members.manage");
}
function protectManager(actor: WorkspaceRole, target: WorkspaceRole) {
  if (target === "OWNER") throw new AuthorizationError("Workspace ownership cannot be changed here.");
  if (actor !== "OWNER" && target === "ADMIN") {
    throw new AuthorizationError("Only the owner can manage administrators.");
  }
}
async function deliverInvite(email: string, url: string, workspaceName: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.SIMVERSE_INVITE_FROM;
  if (!key || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: `You're invited to ${workspaceName} on SIMVERSE`,
        text: `You have been invited to the SIMVERSE workspace "${workspaceName}". Sign in or register with ${email}, then open this private link within 7 days: ${url}\nIf this wasn't expected, ignore this email.` }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch { return false; }
}
export async function listWorkspaceInvitations(userId: string, workspaceId: string) {
  await manager(userId,workspaceId);
  return prisma.workspaceInvitation.findMany({
    where: { workspaceId, expiresAt: { gt: new Date() } },
    select: { id:true,email:true,role:true,expiresAt:true,createdAt:true },
    orderBy: {createdAt:"desc"},
  });
}
export async function inviteWorkspaceMember(userId: string, workspaceId: string, input: unknown) {
  const actor=await manager(userId,workspaceId);
  const parsed=inviteInput.safeParse(input);
  if(!parsed.success) throw new ValidationError("Enter a valid email and role.");
  const {email,role}=parsed.data;
  if(actor.role!=="OWNER" && role==="ADMIN") throw new AuthorizationError("Only the owner can invite administrators.");
  const [workspace, user, outstanding] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({where:{id:workspaceId},select:{name:true}}),
    prisma.user.findUnique({where:{email},select:{id:true}}),
    prisma.workspaceInvitation.count({where:{workspaceId,expiresAt:{gt:new Date()}}}),
  ]);
  if(outstanding>=50) throw new ConflictError("Too many pending invites. Revoke unused invitations first.");
  if(user && await prisma.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId,userId:user.id}}}))
    throw new ConflictError("This person is already a member.");
  await prisma.workspaceInvitation.deleteMany({where:{workspaceId,email}});
  const token=randomBytes(32).toString("base64url");
  const invitation=await prisma.workspaceInvitation.create({
    data: {workspaceId,email,role,tokenHash:hash(token),invitedById:userId,expiresAt:new Date(Date.now()+sevenDays)},
    select:{id:true,email:true,role:true,expiresAt:true,createdAt:true},
  });
  const base=(process.env.APP_URL || "http://localhost:3000").replace(/\/$/,"");
  const inviteUrl=`${base}/join?token=${encodeURIComponent(token)}`;
  const emailSent=await deliverInvite(email,inviteUrl,workspace.name);
  await recordAudit({action:"workspace.invitation_created",actorUserId:userId,workspaceId,entityType:"WorkspaceInvitation",entityId:invitation.id,metadata:{email,role,emailSent}});
  return {invitation,inviteUrl,emailSent};
}
export async function revokeWorkspaceInvitation(userId:string, workspaceId:string, inviteId:string) {
  await manager(userId,workspaceId);
  const result=await prisma.workspaceInvitation.deleteMany({where:{id:inviteId,workspaceId}});
  if(!result.count) throw new NotFoundError("Invitation not found.");
  await recordAudit({action:"workspace.invitation_revoked",actorUserId:userId,workspaceId,entityType:"WorkspaceInvitation",entityId:inviteId});
}
export async function previewWorkspaceInvitation(token:string) {
  if(!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const invite=await prisma.workspaceInvitation.findUnique({
    where:{tokenHash:hash(token)},select:{email:true,role:true,expiresAt:true,workspace:{select:{name:true}}},
  });
  if(!invite || invite.expiresAt<=new Date()) return null;
  return {email:invite.email,role:invite.role,workspaceName:invite.workspace.name};
}
export async function acceptWorkspaceInvitation(userId:string, token:string) {
  if(!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new NotFoundError("Invitation is invalid or expired.");
  const invite=await prisma.workspaceInvitation.findUnique({where:{tokenHash:hash(token)}});
  if(!invite || invite.expiresAt<=new Date() || !isWorkspaceRole(invite.role) || invite.role==="OWNER")
    throw new NotFoundError("Invitation is invalid or expired.");
  const user=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{email:true}});
  if(user.email.toLowerCase()!==invite.email) throw new AuthorizationError("Sign in with the email address that received the invitation.");
  const exists=await prisma.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId:invite.workspaceId,userId}}});
  if(exists) throw new ConflictError("You already belong to this workspace.");
  await prisma.$transaction(async tx=>{
    const deleted=await tx.workspaceInvitation.deleteMany({where:{id:invite.id,expiresAt:{gt:new Date()}}});
    if(!deleted.count) throw new ConflictError("This invitation has already been used or expired.");
    await tx.workspaceMember.create({data:{workspaceId:invite.workspaceId,userId,role:invite.role}});
  });
  await recordAudit({action:"workspace.invitation_accepted",actorUserId:userId,workspaceId:invite.workspaceId,entityType:"WorkspaceMember",entityId:userId});
  return {workspaceId:invite.workspaceId};
}
export async function changeWorkspaceMemberRole(actorId:string,workspaceId:string,memberId:string,input:unknown) {
  const actor=await manager(actorId,workspaceId);
  const parsed=roleInput.safeParse(input);
  if(!parsed.success) throw new ValidationError("Choose a valid staff role.");
  const target=await prisma.workspaceMember.findFirst({where:{id:memberId,workspaceId}});
  if(!target || !isWorkspaceRole(target.role)) throw new NotFoundError("Member not found.");
  if(target.userId===actorId) throw new AuthorizationError("You cannot edit your own role.");
  protectManager(actor.role,target.role);
  if(actor.role!=="OWNER" && parsed.data.role==="ADMIN") throw new AuthorizationError("Only the owner can assign administrators.");
  const updated=await prisma.workspaceMember.update({where:{id:memberId},data:{role:parsed.data.role}});
  await recordAudit({action:"workspace.member_role_changed",actorUserId:actorId,workspaceId,entityType:"WorkspaceMember",entityId:memberId,metadata:{from:target.role,to:updated.role}});
  return {id:updated.id,role:updated.role};
}
export async function removeWorkspaceMember(actorId:string,workspaceId:string,memberId:string) {
  const actor=await manager(actorId,workspaceId);
  const target=await prisma.workspaceMember.findFirst({where:{id:memberId,workspaceId}});
  if(!target || !isWorkspaceRole(target.role)) throw new NotFoundError("Member not found.");
  if(target.userId===actorId) throw new AuthorizationError("You cannot remove yourself from this team.");
  protectManager(actor.role,target.role);
  await prisma.workspaceMember.delete({where:{id:memberId}});
  await recordAudit({action:"workspace.member_removed",actorUserId:actorId,workspaceId,entityType:"WorkspaceMember",entityId:memberId,metadata:{removedUserId:target.userId}});
}
