import { beforeEach,describe,expect,it } from "vitest";
import { NotFoundError,AuthorizationError,ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { STARTER_ANIMATION } from "@/lib/animation/editor";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createAnimationProject,listAnimationProjects,getAnimationProject,saveAnimationProject,deleteAnimationProject } from "./animation-project-service";
beforeEach(async()=>{await resetDb()});
let n=0;async function account(){
  n++;return registerUser({displayName:`Artist ${n}`,email:`anim-${n}@example.com`,password:"Password123",confirmPassword:"Password123"});
}
describe("standalone Animation Studio storage",()=>{
  it("creates, updates, lists and deletes owner-only version-one scenes",async()=>{
    const a=await account(),b=await account();
    const p=await createAnimationProject(a.user.id,a.workspaceId,STARTER_ANIMATION);
    expect((await listAnimationProjects(a.user.id,a.workspaceId)).length).toBe(1);
    expect((await getAnimationProject(a.user.id,a.workspaceId,p.id)).scene.actors).toHaveLength(1);
    await expect(getAnimationProject(b.user.id,b.workspaceId,p.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(saveAnimationProject(b.user.id,b.workspaceId,p.id,STARTER_ANIMATION)).rejects.toBeInstanceOf(NotFoundError);
    const renamed={...STARTER_ANIMATION,title:"My bouncing intro"};
    expect((await saveAnimationProject(a.user.id,a.workspaceId,p.id,renamed)).title).toBe("My bouncing intro");
    await deleteAnimationProject(a.user.id,a.workspaceId,p.id);
    expect(await listAnimationProjects(a.user.id,a.workspaceId)).toHaveLength(0);
  });
  it("requires creator permission; bad keyframes are rejected without database changes",async()=>{
    const a=await account();
    await prisma.workspaceMember.update({where:{workspaceId_userId:{workspaceId:a.workspaceId,userId:a.user.id}},data:{role:"VIEWER"}});
    await expect(createAnimationProject(a.user.id,a.workspaceId,STARTER_ANIMATION)).rejects.toBeInstanceOf(AuthorizationError);
    await prisma.workspaceMember.update({where:{workspaceId_userId:{workspaceId:a.workspaceId,userId:a.user.id}},data:{role:"OWNER"}});
    await expect(createAnimationProject(a.user.id,a.workspaceId,{...STARTER_ANIMATION,durationMs:300}))
      .rejects.toBeInstanceOf(ValidationError);
    expect(await listAnimationProjects(a.user.id,a.workspaceId)).toHaveLength(0);
  });
});