import {describe,it,expect} from "vitest";
import {allowedAdminSections,isInvitableAdminRole,mayManageAdminRole,readDeniedAdminSections,validateAdminRestrictions} from "./permissions";
describe("platform administration permissions",()=>{
 it("does not grant ownership through invitations",()=>expect(isInvitableAdminRole("OWNER")).toBe(false));
 it("limits a moderator to approved sections and respects denies",()=>{
  expect(allowedAdminSections("MODERATOR",["citizens"])).toEqual(["overview","activity","civilization"]);
 });
 it("cannot add sections outside the role",()=>expect(validateAdminRestrictions("VIEWER",["security"])).toBe(false));
 it("only the owner can manage admins",()=>{
  expect(mayManageAdminRole("ADMIN","ADMIN")).toBe(false);
  expect(mayManageAdminRole("OWNER","ADMIN")).toBe(true);
  expect(mayManageAdminRole("MODERATOR","VIEWER")).toBe(false);
 });
 it("tolerates corrupt persisted restrictions safely",()=>expect(readDeniedAdminSections("{broken")).toEqual([]));
});
