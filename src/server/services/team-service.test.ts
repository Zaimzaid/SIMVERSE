import {beforeEach,describe,expect,it} from "vitest";
import {prisma} from "@/server/db/client";
import {registerUser} from "@/server/services/auth-service";
import {inviteWorkspaceMember,previewWorkspaceInvitation,acceptWorkspaceInvitation,
 listWorkspaceInvitations,revokeWorkspaceInvitation,changeWorkspaceMemberRole,removeWorkspaceMember} from "./team-service";
import {createAdditionalWorkspace,updateWorkspace,requireMembership} from "./workspace-service";
import {getAccountPreferences,updateAccountPreferences} from "./account-security-service";
import {resetDb} from "../../../test/helpers/db";
beforeEach(async()=>{await resetDb();});
async function user(email:string){
 return registerUser({displayName:"Test User",email,password:"Password123",confirmPassword:"Password123"});
}
describe("workspace invitations",()=>{
 it("requires email match, expires, and allows one acceptance only",async()=>{
  const owner=await user("owner@example.com");
  const invitee=await user("worker@example.com");
  const wrong=await user("other@example.com");
  const result=await inviteWorkspaceMember(owner.user.id,owner.workspaceId,{email:invitee.user.email,role:"CREATOR"});
  const token=new URL(result.inviteUrl).searchParams.get("token")!;
  expect(result.invitation.email).toBe("worker@example.com");
  expect((await listWorkspaceInvitations(owner.user.id,owner.workspaceId))[0]?.id).toBe(result.invitation.id);
  expect(await previewWorkspaceInvitation(token)).toMatchObject({role:"CREATOR",email:"worker@example.com"});
  await expect(acceptWorkspaceInvitation(wrong.user.id,token)).rejects.toMatchObject({status:403});
  await acceptWorkspaceInvitation(invitee.user.id,token);
  expect((await requireMembership(invitee.user.id,owner.workspaceId)).role).toBe("CREATOR");
  await expect(acceptWorkspaceInvitation(invitee.user.id,token)).rejects.toMatchObject({status:404});
  expect(await previewWorkspaceInvitation(token)).toBeNull();
 });
 it("prevents duplicate memberships and supports revocation",async()=>{
  const owner=await user("owner@example.com");
  const another=await user("worker@example.com");
  await prisma.workspaceMember.create({data:{workspaceId:owner.workspaceId,userId:another.user.id,role:"VIEWER"}});
  await expect(inviteWorkspaceMember(owner.user.id,owner.workspaceId,{email:another.user.email,role:"EDITOR"})).rejects.toMatchObject({status:409});
  const result=await inviteWorkspaceMember(owner.user.id,owner.workspaceId,{email:"new@example.com",role:"EDITOR"});
  await revokeWorkspaceInvitation(owner.user.id,owner.workspaceId,result.invitation.id);
  expect(await previewWorkspaceInvitation(new URL(result.inviteUrl).searchParams.get("token")!)).toBeNull();
 });
 it("protects owners and administrator changes",async()=>{
  const owner=await user("owner@example.com");
  const admin=await user("admin@example.com");
  const worker=await user("worker@example.com");
  const a=await prisma.workspaceMember.create({data:{workspaceId:owner.workspaceId,userId:admin.user.id,role:"ADMIN"}});
  const w=await prisma.workspaceMember.create({data:{workspaceId:owner.workspaceId,userId:worker.user.id,role:"VIEWER"}});
  const o=await prisma.workspaceMember.findUniqueOrThrow({where:{workspaceId_userId:{workspaceId:owner.workspaceId,userId:owner.user.id}}});
  await expect(removeWorkspaceMember(admin.user.id,owner.workspaceId,o.id)).rejects.toMatchObject({status:403});
  await expect(changeWorkspaceMemberRole(admin.user.id,owner.workspaceId,w.id,{role:"ADMIN"})).rejects.toMatchObject({status:403});
  await expect(removeWorkspaceMember(worker.user.id,owner.workspaceId,a.id)).rejects.toMatchObject({status:403});
  await changeWorkspaceMemberRole(owner.user.id,owner.workspaceId,w.id,{role:"EDITOR"});
  expect((await requireMembership(worker.user.id,owner.workspaceId)).role).toBe("EDITOR");
  await removeWorkspaceMember(owner.user.id,owner.workspaceId,w.id);
  await expect(requireMembership(worker.user.id,owner.workspaceId)).rejects.toMatchObject({status:404});
 });
});
describe("workspace and account settings",()=>{
 it("creates another workspace with OWNER membership",async()=>{
  const a=await user("owner@example.com");
  const second=await createAdditionalWorkspace(a.user.id,{name:"New Studio"});
  expect((await requireMembership(a.user.id,second.id)).role).toBe("OWNER");
  expect(second.name).toBe("New Studio");
 });
 it("preserves the workspace logo when only renaming",async()=>{
  const a=await user("owner@example.com");
  await updateWorkspace(a.user.id,a.workspaceId,{name:"Original",logoUrl:"https://example.com/logo.png"});
  await updateWorkspace(a.user.id,a.workspaceId,{name:"Changed"});
  expect((await prisma.workspace.findUniqueOrThrow({where:{id:a.workspaceId}})).logoUrl).toBe("https://example.com/logo.png");
  await updateWorkspace(a.user.id,a.workspaceId,{name:"Changed",logoUrl:""});
  expect((await prisma.workspace.findUniqueOrThrow({where:{id:a.workspaceId}})).logoUrl).toBeNull();
 });
 it("updates actual social notification preference",async()=>{
  const a=await user("owner@example.com");
  expect((await getAccountPreferences(a.user.id)).socialAlertsEnabled).toBe(true);
  await updateAccountPreferences(a.user.id,{socialAlertsEnabled:false});
  expect((await getAccountPreferences(a.user.id)).socialAlertsEnabled).toBe(false);
 });
});
