import {beforeEach,describe,expect,it,vi} from "vitest";
import {prisma} from "@/server/db/client";
import {registerUser} from "@/server/services/auth-service";
import {resetDb} from "../../../test/helpers/db";

const actor=vi.hoisted(()=>({userId:"",role:"OWNER",sections:["overview","activity","citizens","workspaces","civilization","security","staff"]}));
vi.mock("@/server/admin/access",()=>({
 requireAdminAccess:async()=>({user:{id:actor.userId},role:actor.role,sections:actor.sections}),
 verifyAdminTotp:async(_id:string,code:unknown)=>{
  if(code!=="123456")throw Object.assign(new Error("Incorrect authenticator code."),{status:401});
 },
}));

import {
 createAdminInvitation,previewAdminInvitation,acceptAdminInvitation,revokeAdminInvitation,
 updateAdminStaff,listAdminStaff,isPlatformAdminInviteToken,
} from "./service";

async function user(email:string){
 return registerUser({displayName:"Test User",email,password:"Password123",confirmPassword:"Password123"});
}
beforeEach(async()=>{
 await resetDb();
 actor.userId="";
 actor.role="OWNER";
});
describe("KAVANDRO platform-admin invitations",()=>{
 it("requires the invited email and TOTP, and consumes the link once",async()=>{
  const owner=await user("owner@example.com");
  const invited=await user("teammate@example.com");
  const wrong=await user("wrong@example.com");
  actor.userId=owner.user.id;
  await prisma.platformAdmin.create({data:{userId:owner.user.id,role:"OWNER"}});
  const invitation=await createAdminInvitation({email:invited.user.email,role:"VIEWER",deniedSections:[]});
  const token=new URL(invitation.inviteUrl).searchParams.get("token")!;
  expect(isPlatformAdminInviteToken(token)).toBe(true);
  expect(await previewAdminInvitation(token)).toMatchObject({email:"teammate@example.com",role:"VIEWER"});
  await expect(acceptAdminInvitation(wrong.user.id,token,"123456")).rejects.toMatchObject({status:403});
  await expect(acceptAdminInvitation(invited.user.id,token,"000000")).rejects.toMatchObject({status:401});
  await acceptAdminInvitation(invited.user.id,token,"123456");
  expect((await prisma.platformAdmin.findUnique({where:{userId:invited.user.id}}))?.role).toBe("VIEWER");
  expect(await previewAdminInvitation(token)).toBeNull();
  await expect(acceptAdminInvitation(invited.user.id,token,"123456")).rejects.toMatchObject({status:404});
 });
 it("rejects sections outside a role and supports invitation revocation",async()=>{
  const owner=await user("owner@example.com");
  actor.userId=owner.user.id;
  await prisma.platformAdmin.create({data:{userId:owner.user.id,role:"OWNER"}});
  await expect(createAdminInvitation({email:"new@example.com",role:"VIEWER",deniedSections:["security"]}))
   .rejects.toMatchObject({status:400});
  const invitation=await createAdminInvitation({email:"new@example.com",role:"MODERATOR",deniedSections:["citizens"]});
  expect(await previewAdminInvitation(new URL(invitation.inviteUrl).searchParams.get("token")!)).not.toBeNull();
  await revokeAdminInvitation(invitation.id);
  expect(await previewAdminInvitation(new URL(invitation.inviteUrl).searchParams.get("token")!)).toBeNull();
 });
 it("does not permit an admin to grant admin role or edit a peer",async()=>{
  const owner=await user("owner@example.com");
  const manager=await user("manager@example.com");
  const other=await user("other@example.com");
  const staffOwner=await prisma.platformAdmin.create({data:{userId:owner.user.id,role:"OWNER"}});
  const staffAdmin=await prisma.platformAdmin.create({data:{userId:manager.user.id,role:"ADMIN"}});
  const staffPeer=await prisma.platformAdmin.create({data:{userId:other.user.id,role:"ADMIN"}});
  actor.userId=manager.user.id;actor.role="ADMIN";
  await expect(createAdminInvitation({email:"new@example.com",role:"ADMIN",deniedSections:[]}))
   .rejects.toMatchObject({status:403});
  await expect(updateAdminStaff(staffPeer.id,{active:false})).rejects.toMatchObject({status:403});
  await expect(updateAdminStaff(staffOwner.id,{active:false})).rejects.toMatchObject({status:403});
  await expect(updateAdminStaff(staffAdmin.id,{active:false})).rejects.toMatchObject({status:403});
  actor.userId=owner.user.id;actor.role="OWNER";
  const updated=await updateAdminStaff(staffPeer.id,{role:"MODERATOR",deniedSections:["citizens"],active:false});
  expect(updated).toMatchObject({role:"MODERATOR",deniedSections:["citizens"],active:false});
  expect((await listAdminStaff()).staff.find(item=>item.id===staffPeer.id)?.active).toBe(false);
 });
});
