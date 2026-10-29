import {beforeEach,describe,expect,it} from "vitest";
import {createHmac,randomBytes} from "node:crypto";
import {prisma} from "@/server/db/client";
import {env} from "@/lib/env";
import {registerUser} from "./auth-service";
import {resetDb} from "../../../test/helpers/db";
import {createTotpSecret,totpAt,encryptSecret,decryptSecret,makeRecoveryCodes,hashRecoveryCode} from "@/server/auth/totp";
import {beginTwoFactorChallenge,completeTwoFactorChallenge} from "./two-factor-service";
import {verifyEmailToken} from "./email-verification-service";
import {saveUserAvatar,saveWorkspaceLogo,getUploadedImage,validateImageBytes} from "./uploaded-image-service";
beforeEach(async()=>{await resetDb();});
async function makeUser(email:string) {
 return registerUser({displayName:"Example User",email,password:"Password123",confirmPassword:"Password123"});
}
describe("two-factor security",()=>{
 it("generates RFC6238-compatible codes, encrypts secrets and hashes recovery codes",()=>{
  const secret="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  expect(totpAt(secret,59000)).toBe("287082");
  expect(createTotpSecret()).toMatch(/^[A-Z2-7]+$/);
  expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  const recovery=makeRecoveryCodes("test-user");
  expect(recovery.codes).toHaveLength(8);
  expect(recovery.hashes[0]).toBe(hashRecoveryCode("test-user",recovery.codes[0]!));
  expect(recovery.hashes[0]).not.toContain(recovery.codes[0]!);
 });
 it("requires a valid one-use challenge and a correct authenticator code",async()=>{
  const owner=await makeUser("totp@example.com");
  const secret=createTotpSecret();
  await prisma.user.update({where:{id:owner.user.id},data:{twoFactorSecret:encryptSecret(secret),twoFactorEnabledAt:new Date(),twoFactorRecoveryHashes:"[]"}});
  const challenge=await beginTwoFactorChallenge(owner.user.id);
  await expect(completeTwoFactorChallenge({challenge,code:"not-code"})).rejects.toMatchObject({status:401});
  await expect(completeTwoFactorChallenge({challenge,code:totpAt(secret,Date.now())})).resolves.toBe(owner.user.id);
  await expect(completeTwoFactorChallenge({challenge,code:totpAt(secret,Date.now())})).rejects.toMatchObject({status:401});
 });
 it("locks a challenge after five wrong attempts",async()=>{
  const owner=await makeUser("lock@example.com");
  const secret=createTotpSecret();
  await prisma.user.update({where:{id:owner.user.id},data:{twoFactorSecret:encryptSecret(secret),twoFactorEnabledAt:new Date(),twoFactorRecoveryHashes:"[]"}});
  const challenge=await beginTwoFactorChallenge(owner.user.id);
  for(let i=0;i<5;i++)await expect(completeTwoFactorChallenge({challenge,code:"000000"})).rejects.toMatchObject({status:401});
  await expect(completeTwoFactorChallenge({challenge,code:totpAt(secret,Date.now())})).rejects.toMatchObject({status:401});
 });
 it("consumes recovery codes exactly once",async()=>{
  const owner=await makeUser("recovery@example.com");
  const {codes,hashes}=makeRecoveryCodes(owner.user.id);
  await prisma.user.update({where:{id:owner.user.id},data:{twoFactorSecret:encryptSecret(createTotpSecret()),twoFactorEnabledAt:new Date(),twoFactorRecoveryHashes:JSON.stringify(hashes)}});
  const first=await beginTwoFactorChallenge(owner.user.id);
  await completeTwoFactorChallenge({challenge:first,code:codes[0]});
  const second=await beginTwoFactorChallenge(owner.user.id);
  await expect(completeTwoFactorChallenge({challenge:second,code:codes[0]})).rejects.toMatchObject({status:401});
 });
});
describe("email verification",()=>{
 it("confirms only unexpired single-use tokens",async()=>{
  const user=await makeUser("verify@example.com");
  await prisma.user.update({where:{id:user.user.id},data:{emailVerificationRequired:true}});
  const token=randomBytes(32).toString("base64url");
  const tokenHash=createHmac("sha256",env.SESSION_SECRET).update("verify-email:"+token).digest("hex");
  await prisma.emailVerificationToken.create({data:{userId:user.user.id,tokenHash,expiresAt:new Date(Date.now()+86400000)}});
  await verifyEmailToken(token);
  expect((await prisma.user.findUniqueOrThrow({where:{id:user.user.id}})).emailVerifiedAt).not.toBeNull();
  await expect(verifyEmailToken(token)).rejects.toMatchObject({status:404});
 });
});
describe("image upload",()=>{
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
 it("only accepts small correctly identified PNG, JPEG and WebP images",()=>{
  expect(validateImageBytes(png,"image/png")).toBe("image/png");
  expect(()=>validateImageBytes(png,"image/svg+xml")).toThrow();
  expect(()=>validateImageBytes(new Uint8Array(600001),"image/png")).toThrow();
 });
 it("persists profile and workspace images and checks roles",async()=>{
  const a=await makeUser("upload@example.com");
  const b=await makeUser("viewer@example.com");
  const avatar=await saveUserAvatar(a.user.id,png,"image/png");
  expect(avatar.url).toMatch(/^\/api\/images\//);
  expect((await getUploadedImage(avatar.url.split("/").pop()!)).mediaType).toBe("image/png");
  await expect(saveWorkspaceLogo(b.user.id,a.workspaceId,png,"image/png")).rejects.toMatchObject({status:404});
  const logo=await saveWorkspaceLogo(a.user.id,a.workspaceId,png,"image/png");
  expect(logo.url).toMatch(/^\/api\/images\//);
 });
});
