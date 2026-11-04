import {describe,it,expect} from "vitest";
import {adminAuditWhere,scopedAdminAuditWhere,parseAdminEventFilter,parseAdminAuditWindow} from "./audit-filters";

describe("platform audit filters",()=>{
 const now=new Date("2026-11-04T12:00:00.000Z");
 it("defaults invalid filter/window safely",()=>{
  expect(parseAdminEventFilter("invalid")).toBe("all");
  expect(parseAdminAuditWindow("invalid")).toBe("7d");
  expect(parseAdminAuditWindow("all")).toBe("all");
 });
 it("bounds recent events with inclusive start and no future records",()=>{
  expect(adminAuditWhere("all","24h",now)).toEqual({
   createdAt:{gte:new Date("2026-11-03T12:00:00.000Z"),lte:now},
  });
  expect(adminAuditWhere("all","all",now)).toEqual({});
 });
 it("filters security without classifying every user profile edit as a security event",()=>{
  const where=adminAuditWhere("security","7d",now);
  expect(JSON.stringify(where)).toContain("platform_admin.code_");
  expect(JSON.stringify(where)).toContain("user.logged_in");
  expect(JSON.stringify(where)).not.toContain("user.profile_updated");
  expect(JSON.stringify(where)).toContain("createdAt");
 });
 it("covers real civilization, game run and staff action families",()=>{
  expect(JSON.stringify(adminAuditWhere("civilization","all",now))).toContain("development.");
  expect(JSON.stringify(adminAuditWhere("content","all",now))).toContain("simulation_run.");
  expect(JSON.stringify(adminAuditWhere("staff","all",now))).toContain("platform_admin.");
 });
 it("enforces section denials against the all-events query",()=>{
  const restricted=scopedAdminAuditWhere("all","all",["overview","activity"],now);
  const conditions=JSON.stringify(restricted);
  expect(conditions).toContain("NOT");
  expect(conditions).toContain("platform_admin.");
  expect(conditions).toContain("account.");
  expect(conditions).toContain("development.");
  expect(scopedAdminAuditWhere("all","all",
   ["overview","activity","security","staff","civilization"],now)).toEqual({});
 });
});
