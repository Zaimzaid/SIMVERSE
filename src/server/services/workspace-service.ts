import type { Workspace, WorkspaceMember } from "@prisma/client";
import {randomBytes} from "node:crypto";
import {slugify} from "@/lib/utils";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import {
  can,
  isWorkspaceRole,
  type Permission,
  type WorkspaceRole,
} from "@/lib/permissions";
import type { MemberWithUser } from "@/lib/types";
import { parseOrThrow, updateWorkspaceSchema } from "@/lib/validation";
import { prisma, SAFE_USER_OMIT } from "@/server/db/client";
import { recordAudit } from "./audit-service";

export interface ResolvedMembership extends WorkspaceMember {
  role: WorkspaceRole;
}

/**
 * The core workspace-isolation guard. Confirms the user is a member of the
 * workspace and (optionally) holds a required permission.
 *
 * A non-member receives NotFoundError — never AuthorizationError — so that
 * changing a workspace id in a URL cannot reveal whether another user's
 * private workspace exists.
 */
export async function requireMembership(
  userId: string,
  workspaceId: string,
  permission?: Permission,
): Promise<ResolvedMembership> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership || !isWorkspaceRole(membership.role)) {
    throw new NotFoundError("Workspace not found.");
  }

  const role = membership.role;
  if (permission && !can(role, permission)) {
    throw new AuthorizationError();
  }

  return { ...membership, role };
}

/** Get a workspace the user is allowed to view. */
export async function getWorkspaceForUser(
  userId: string,
  workspaceId: string,
): Promise<Workspace> {
  await requireMembership(userId, workspaceId, "workspace.view");
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) throw new NotFoundError("Workspace not found.");
  return workspace;
}

/** List every workspace the user belongs to (ordered by join time). */
export async function listWorkspacesForUser(
  userId: string,
): Promise<Workspace[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => m.workspace);
}

/** Update a workspace's editable fields. Requires workspace.edit. */
export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<Workspace> {
  await requireMembership(userId, workspaceId, "workspace.edit");
  const data = parseOrThrow(updateWorkspaceSchema, input);

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name: data.name, ...(typeof input === "object" && input !== null && Object.hasOwn(input, "logoUrl")
      ? { logoUrl: data.logoUrl ?? null } : {}) },
  });

  await recordAudit({
    action: "workspace.updated",
    actorUserId: userId,
    workspaceId,
    entityType: "Workspace",
    entityId: workspaceId,
    metadata: { name: data.name },
  });

  return updated;
}

/** List members of a workspace. Requires workspace.members.view. */
export async function getWorkspaceMembers(
  userId: string,
  workspaceId: string,
): Promise<MemberWithUser[]> {
  await requireMembership(userId, workspaceId, "workspace.members.view");

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { omit: SAFE_USER_OMIT } },
    orderBy: { createdAt: "asc" },
  });

  return members.map((member) => ({
    ...member,
    role: isWorkspaceRole(member.role) ? member.role : "VIEWER",
  }));
}

/** Create an additional private workspace, with the user as its owner. */
export async function createAdditionalWorkspace(userId:string,input:unknown) {
 const parsed=updateWorkspaceSchema.safeParse(input);
 if(!parsed.success) throw new (await import("@/lib/errors")).ValidationError("Enter a workspace name (2–60 characters).");
 const total=await prisma.workspace.count({where:{ownerId:userId}});
 if(total>=10) throw new (await import("@/lib/errors")).ConflictError("You can own up to ten workspaces.");
 const slug=`${slugify(parsed.data.name)||"workspace"}-${randomBytes(4).toString("hex")}`;
 const workspace=await prisma.$transaction(async tx=>{
   const w=await tx.workspace.create({data:{name:parsed.data.name,logoUrl:parsed.data.logoUrl??null,ownerId:userId,slug}});
   await tx.workspaceMember.create({data:{workspaceId:w.id,userId,role:"OWNER"}});
   return w;
 });
 await recordAudit({action:"workspace.created_additional",actorUserId:userId,workspaceId:workspace.id,entityType:"Workspace",entityId:workspace.id});
 return workspace;
}
