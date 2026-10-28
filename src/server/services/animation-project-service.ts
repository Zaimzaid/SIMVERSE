import { prisma } from "@/server/db/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { saveAnimationSchema, type AnimationDraft, type AnimationScene } from "@/lib/animation/editor";
import { requireMembership } from "./workspace-service";

function parseDraft(value: unknown): AnimationDraft {
  const parsed = saveAnimationSchema.safeParse(value);
  if (!parsed.success) throw new ValidationError("Check scene title, actor keyframes and timeline values.");
  return parsed.data;
}
const select = { id:true, title:true, durationMs:true, sceneJson:true, createdAt:true, updatedAt:true } as const;
function serialize(row: { id:string; title:string; durationMs:number; sceneJson:string; createdAt:Date; updatedAt:Date }) {
  return { id:row.id,title:row.title,durationMs:row.durationMs,
    scene:JSON.parse(row.sceneJson) as AnimationScene,createdAt:row.createdAt,updatedAt:row.updatedAt };
}
export async function listAnimationProjects(userId: string, workspaceId: string) {
  await requireMembership(userId,workspaceId,"media.view");
  const rows=await prisma.animationProject.findMany({
    where:{ownerId:userId,workspaceId},orderBy:{updatedAt:"desc"},take:50,select,
  });
  return rows.map(serialize);
}
export async function getAnimationProject(userId:string,workspaceId:string,id:string) {
  await requireMembership(userId,workspaceId,"media.view");
  const row=await prisma.animationProject.findFirst({
    where:{id,ownerId:userId,workspaceId},select,
  });
  if(!row)throw new NotFoundError("Animation not found.");
  return serialize(row);
}
export async function createAnimationProject(userId:string,workspaceId:string,value:unknown) {
  await requireMembership(userId,workspaceId,"media.create");
  const parsed=parseDraft(value);
  const count=await prisma.animationProject.count({where:{ownerId:userId,workspaceId}});
  if(count>=60)throw new ValidationError("Your workspace animation library is full (60 projects).");
  const row=await prisma.animationProject.create({
    data:{ownerId:userId,workspaceId,title:parsed.title,durationMs:parsed.durationMs,
      sceneJson:JSON.stringify(parsed.scene)},select,
  });
  return serialize(row);
}
export async function saveAnimationProject(userId:string,workspaceId:string,id:string,value:unknown) {
  await requireMembership(userId,workspaceId,"media.edit");
  const parsed=parseDraft(value);
  const changed=await prisma.animationProject.updateMany({
    where:{id,ownerId:userId,workspaceId},
    data:{title:parsed.title,durationMs:parsed.durationMs,sceneJson:JSON.stringify(parsed.scene)},
  });
  if(!changed.count)throw new NotFoundError("Animation not found or not editable.");
  return getAnimationProject(userId,workspaceId,id);
}
export async function deleteAnimationProject(userId:string,workspaceId:string,id:string) {
  await requireMembership(userId,workspaceId,"media.edit");
  const result=await prisma.animationProject.deleteMany({where:{id,ownerId:userId,workspaceId}});
  if(!result.count)throw new NotFoundError("Animation not found.");
}
