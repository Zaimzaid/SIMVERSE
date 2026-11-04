import {beforeEach,describe,expect,it,vi} from "vitest";
import {prisma} from "@/server/db/client";
import {resetDb} from "../../../test/helpers/db";

vi.mock("./access",()=>({
 requireAdminAccess:async()=>({user:{id:"staff"},role:"ANALYST",sections:["overview","activity"]}),
 verifyAdminTotp:vi.fn(),
}));
import {listAdminAudit,exportAdminAudit} from "./service";

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
});