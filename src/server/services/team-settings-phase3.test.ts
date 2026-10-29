import {beforeEach,describe,expect,it} from "vitest";
import {prisma} from "@/server/db/client";
import {registerUser} from "./auth-service";
import {createProject} from "./project-service";
import {requireMembership} from "./workspace-service";
import {updateMemberRestrictions} from "./team-service";
import {effectivePermissions,parseDeniedPermissions} from "@/lib/permissions";
import {assignProjectMember,listProjectAssignments,updateProjectAssignment,removeProjectAssignment} from "./project-assignment-service";
import {createAccountExport,requestAccountDeletion,cancelAccountDeletion,getAccountDeletionRequest} from "./account-data-service";
import {resetDb} from "../../../test/helpers/db";
beforeEach(async()=>await resetDb());
async function user(email:string){return registerUser({
 displayName:"Sample Tester",email,password:"Password123",confirmPassword:"Password123",
});}
describe("custom member restrictions",()=>{
 it("restricts centrally without ever increasing base role authority",async()=>{
  const owner=await user("owner@example.com");const worker=await user("worker@example.com");
  const member=await prisma.workspaceMember.create({data:{workspaceId:owner.workspaceId,userId:worker.user.id,role:"CREATOR"}});
  expect((await requireMembership(worker.user.id,owner.workspaceId,"project.create")).role).toBe("CREATOR");
  await updateMemberRestrictions(owner.user.id,owner.workspaceId,member.id,{deniedPermissions:["project.create"]});
  await expect(requireMembership(worker.user.id,owner.workspaceId,"project.create")).rejects.toMatchObject({status:403});
  await expect(requireMembership(worker.user.id,owner.workspaceId,"project.view")).resolves.toBeTruthy();
  await expect(updateMemberRestrictions(owner.user.id,owner.workspaceId,member.id,{deniedPermissions:["workspace.delete"]})).rejects.toMatchObject({status:400});
  await expect(updateMemberRestrictions(worker.user.id,owner.workspaceId,member.id,{deniedPermissions:[]})).rejects.toMatchObject({status:403});
  await updateMemberRestrictions(owner.user.id,owner.workspaceId,member.id,{deniedPermissions:[]});
  await expect(requireMembership(worker.user.id,owner.workspaceId,"project.create")).resolves.toBeTruthy();
 });
 it("never denies owner permissions and ignores corrupt JSON safely",()=>{
  expect(effectivePermissions("OWNER",JSON.stringify(["workspace.delete"]))).toContain("workspace.delete");
  expect(parseDeniedPermissions("garbled")).toEqual([]);
  expect(effectivePermissions("VIEWER",JSON.stringify(["project.create"]))).not.toContain("project.create");
 });
});
describe("project team assignments",()=>{
 it("assigns only members of that workspace and records responsibility",async()=>{
  const owner=await user("owner@example.com");
  const worker=await user("worker@example.com");
  const outside=await user("outside@example.com");
  const member=await prisma.workspaceMember.create({data:{workspaceId:owner.workspaceId,userId:worker.user.id,role:"EDITOR"}});
  const project=await createProject(owner.user.id,owner.workspaceId,{name:"Project North"});
  const outsideMembership=await prisma.workspaceMember.findUniqueOrThrow({where:{workspaceId_userId:{workspaceId:outside.workspaceId,userId:outside.user.id}}});
  await expect(assignProjectMember(owner.user.id,owner.workspaceId,project.id,{membershipId:outsideMembership.id,responsibility:"LEAD"})).rejects.toMatchObject({status:404});
  const assigned=await assignProjectMember(owner.user.id,owner.workspaceId,project.id,{membershipId:member.id,responsibility:"LEAD",notes:"Art assets"});
  expect(assigned.notes).toBe("Art assets");
  await expect(assignProjectMember(owner.user.id,owner.workspaceId,project.id,{membershipId:member.id,responsibility:"LEAD"})).rejects.toMatchObject({status:409});
  const all=await listProjectAssignments(worker.user.id,owner.workspaceId,project.id);
  expect(all).toHaveLength(1);
  await expect(updateProjectAssignment(worker.user.id,owner.workspaceId,project.id,assigned.id,{responsibility:"REVIEWER"})).rejects.toMatchObject({status:403});
  await updateProjectAssignment(owner.user.id,owner.workspaceId,project.id,assigned.id,{responsibility:"REVIEWER"});
  expect((await listProjectAssignments(owner.user.id,owner.workspaceId,project.id))[0]?.responsibility).toBe("REVIEWER");
  await removeProjectAssignment(owner.user.id,owner.workspaceId,project.id,assigned.id);
  expect(await listProjectAssignments(owner.user.id,owner.workspaceId,project.id)).toHaveLength(0);
 });
});
describe("account portability and deletion requests",()=>{
 it("exports a safe account snapshot without credential secrets",async()=>{
  const a=await user("export@example.com");
  const exportData=await createAccountExport(a.user.id);
  expect(exportData.account.email).toBe("export@example.com");
  expect(exportData.workspaceMemberships).toHaveLength(1);
  expect(JSON.stringify(exportData)).not.toContain("passwordHash");
  expect(JSON.stringify(exportData)).not.toContain("twoFactorSecret");
 });
 it("requires password and explicit confirmation and allows cancellation",async()=>{
  const a=await user("delete@example.com");
  await expect(requestAccountDeletion(a.user.id,{password:"Wrong123",confirmation:"DELETE MY ACCOUNT"})).rejects.toMatchObject({status:401});
  await expect(requestAccountDeletion(a.user.id,{password:"Password123",confirmation:"delete"})).rejects.toMatchObject({status:400});
  const requested=await requestAccountDeletion(a.user.id,{password:"Password123",confirmation:"DELETE MY ACCOUNT"});
  expect(requested.status).toBe("PENDING");
  expect((await getAccountDeletionRequest(a.user.id))?.status).toBe("PENDING");
  await expect(requestAccountDeletion(a.user.id,{password:"Password123",confirmation:"DELETE MY ACCOUNT"})).rejects.toMatchObject({status:409});
  await cancelAccountDeletion(a.user.id);
  expect((await getAccountDeletionRequest(a.user.id))?.status).toBe("CANCELLED");
  expect(await prisma.user.findUnique({where:{id:a.user.id}})).not.toBeNull();
 });
});
