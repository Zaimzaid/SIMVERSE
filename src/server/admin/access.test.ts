import {describe,it,expect} from "vitest";
import {makeAdminStepupTicket,validAdminStepupTicket} from "./access";
describe("platform admin step-up ticket",()=>{
 it("is bound to one user and one live login session",()=>{
  const now=Date.now(),expires=now+30_000;
  const ticket=makeAdminStepupTicket("u1","session1",expires);
  expect(validAdminStepupTicket(ticket,"u1","session1",now)).toBe(true);
  expect(validAdminStepupTicket(ticket,"u2","session1",now)).toBe(false);
  expect(validAdminStepupTicket(ticket,"u1","session2",now)).toBe(false);
 });
 it("rejects expiry, tampering, and too-long sessions",()=>{
  const now=Date.now();
  const expired=makeAdminStepupTicket("user","session",now-1);
  expect(validAdminStepupTicket(expired,"user","session",now)).toBe(false);
  const future=makeAdminStepupTicket("user","session",now+70*60_000);
  expect(validAdminStepupTicket(future,"user","session",now)).toBe(false);
  const good=makeAdminStepupTicket("user","session",now+30_000);
  const tampered=good.slice(0,-1)+(good.endsWith("0")?"1":"0");
  expect(validAdminStepupTicket(tampered,"user","session",now)).toBe(false);
 });
});
