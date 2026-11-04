import {beforeEach,describe,it,expect} from "vitest";
import {takeAdminTotpAttempt,clearAdminTotpAttempts,resetAdminTotpAttemptsForTests} from "./totp-rate-limit";
beforeEach(()=>resetAdminTotpAttemptsForTests());
describe("admin TOTP brute-force limiter",()=>{
 it("limits attempts to five per 15 minute window",()=>{
  for(let i=0;i<5;i++)expect(takeAdminTotpAttempt("user-1",1000)).toBe(true);
  expect(takeAdminTotpAttempt("user-1",1000)).toBe(false);
  expect(takeAdminTotpAttempt("user-2",1000)).toBe(true);
  expect(takeAdminTotpAttempt("user-1",1000+15*60_000+1)).toBe(true);
 });
 it("clears the bucket after a successful verification",()=>{
  for(let i=0;i<5;i++)takeAdminTotpAttempt("user-1",1000);
  clearAdminTotpAttempts("user-1");
  expect(takeAdminTotpAttempt("user-1",1000)).toBe(true);
 });
});
