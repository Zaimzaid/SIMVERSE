import {beforeEach,describe,expect,it,vi} from "vitest";
import {prisma} from "@/server/db/client";
import {resetDb} from "../../../test/helpers/db";

vi.mock("./access",()=>({
 requireAdminAccess:async()=>({user:{id:"staff"},role:"ANALYST",sections:["overview","activity","workspaces"]}),
 verifyAdminTotp:vi.fn(),
}));
import {listAdminAudit,exportAdminAudit,listAdminWorkspaces} from "./service";

beforeEach(async()=>resetDb());
describe("restricted administrator audit feed",()=>{
 it("prevents cross-section reads in activity and CSV and masks the citizen",async()=>{
  const user=await prisma.user.create({data:{
   displayName:"Citizen",email:"citizen@example.com",passwordHash:"test-hash",
  }});
  await prisma.auditLog.createMany({data:[
   {action:"club.message_posted",actorUserId:user.id},
   {action:"platform_admin.staff_updated",actorUserId:user.id},
   {action:"account.two_factor_disabled",actorUserId:user.id},
   {action:"development.feasibility_started",actorUserId:user.id},
  ]});
  const list=await listAdminAudit("all",0,"activity","7d");
  expect(list.rows.map(row=>row.action)).toEqual(["club.message_posted"]);
  expect(list.rows[0]?.actor?.displayName).toBe("Restricted");
  const csvData=await exportAdminAudit("all","7d");
  expect(csvData.map(row=>row.action)).toEqual(["club.message_posted"]);
  expect(csvData[0]?.actor?.email).toBe("");
  expect(csvData[0]?.entityId).toBeNull();
 });
 it("does not leak workspace owner emails when the citizen directory is denied",async()=>{
  const person=await prisma.user.create({data:{
   displayName:"Private Owner",email:"private-owner@example.com",passwordHash:"test-hash",
  }});
  await prisma.workspace.create({data:{name:"Test Workspace",slug:"test-admin-redaction",ownerId:person.id}});
  const workspaces=await listAdminWorkspaces();
  expect(workspaces.rows[0]?.owner).toEqual({displayName:"Restricted",email:""});
 });
});