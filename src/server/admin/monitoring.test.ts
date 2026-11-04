import {beforeEach,describe,expect,it,vi} from "vitest";
import {prisma} from "@/server/db/client";
import {resetDb} from "../../../test/helpers/db";
vi.mock("./access",()=>({requireAdminAccess:vi.fn(async()=>({}))}));
import {getAdminMonitoring} from "./monitoring";

beforeEach(async()=>resetDb());
describe("content-free admin operations monitoring",()=>{
 it("returns seven UTC buckets, valid counts and an actual audit security signal",async()=>{
  const now=new Date();
  const today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),12));
  const auditDay=today>now?new Date(today.getTime()-86_400_000):today;
  await prisma.auditLog.create({data:{action:"platform_admin.code_rejected",createdAt:auditDay}});
  const result=await getAdminMonitoring(now);
  expect(result.daily).toHaveLength(7);
  expect(result.daily.at(-1)?.day).toBe(now.toISOString().slice(0,10));
  expect(result.daily.reduce((sum,day)=>sum+day.events,0)).toBeGreaterThanOrEqual(1);
  expect(result.queue).toEqual({openClubReports:0,openAssemblyReports:0,pendingProposals:0});
  expect(result.regions).toEqual({topCountries:[],topDistricts:[]});
  expect(result.security.rejectedAdminCodes24h).toBeGreaterThanOrEqual(0);
  expect(result).not.toHaveProperty("messages");
 });
});
