import {beforeEach,describe,expect,it} from "vitest";
import {prisma} from "@/server/db/client";
import {AuthorizationError,NotFoundError,ValidationError} from "@/lib/errors";
import {registerUser} from "./auth-service";
import {resetDb} from "../../../test/helpers/db";
import {requestFriend,respondFriend,sendMessage} from "./social-service";
import {createSocialGroup,listSocialGroups,respondGroupInvite,groupMessages,sendGroupMessage,
  reactToMessage,notifications,readNotifications,sendCallSignal,receiveCallSignals} from "./social-advanced-service";
beforeEach(async()=>await resetDb());
let n=0;
async function member(){
  n++;const account=await registerUser({displayName:`Group User ${n}`,email:`v2group${n}@example.com`,
    password:"Password123",confirmPassword:"Password123"});
  await prisma.playerIdentity.update({where:{userId:account.user.id},data:{username:`groupuser_${n}`,profileVisibility:"PUBLIC"}});
  return account.user.id;
}
async function befriend(a:string,b:string){
  const f=await requestFriend(a,{userId:b});await respondFriend(b,f.id,"ACCEPT");
}
describe("SIMVERSE social expansion",()=>{
  it("guards group creation and private messages with invitation acceptance",async()=>{
    const a=await member(),b=await member(),stranger=await member();
    await expect(createSocialGroup(a,{title:"Our Group",invitees:[stranger]})).rejects.toBeInstanceOf(AuthorizationError);
    await befriend(a,b);
    const group=await createSocialGroup(a,{title:"Our Group",invitees:[b]});
    expect((await listSocialGroups(b))[0]?.status).toBe("INVITED");
    await expect(groupMessages(b,group.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(sendGroupMessage(stranger,{groupId:group.id,body:"Hello"})).rejects.toBeInstanceOf(NotFoundError);
    await respondGroupInvite(b,group.id,"ACCEPT");
    const msg=await sendGroupMessage(b,{groupId:group.id,body:"Hi friends"});
    expect(msg.body).toBe("Hi friends");
    expect((await groupMessages(a,group.id))[0]?.body).toBe("Hi friends");
    expect((await reactToMessage(a,{kind:"GROUP",messageId:msg.id,emoji:"❤️"})).active).toBe(true);
    expect((await reactToMessage(a,{kind:"GROUP",messageId:msg.id,emoji:"❤️"})).active).toBe(false);
    await expect(reactToMessage(stranger,{kind:"GROUP",messageId:msg.id,emoji:"👍"})).rejects.toBeInstanceOf(NotFoundError);
  });
  it("validates HTTPS media links and separates direct message reactions",async()=>{
    const a=await member(),b=await member(),outsider=await member();
    await befriend(a,b);
    await expect(sendGroupMessage(a,{groupId:"none",body:"",mediaUrl:"javascript:alert(1)"})).rejects.toBeInstanceOf(ValidationError);
    const direct=await sendMessage(a,{recipientId:b,body:"Picture",mediaUrl:"https://example.com/photo.png"});
    expect(direct.mediaUrl).toBe("https://example.com/photo.png");
    expect((await reactToMessage(b,{kind:"DIRECT",messageId:direct.id,emoji:"👍"})).active).toBe(true);
    await expect(reactToMessage(outsider,{kind:"DIRECT",messageId:direct.id,emoji:"👍"})).rejects.toBeInstanceOf(NotFoundError);
  });
  it("records private notifications and gates call signaling to accepted friends",async()=>{
    const a=await member(),b=await member(),c=await member();
    await befriend(a,b);
    expect((await notifications(b)).unread).toBeGreaterThan(0);
    await readNotifications(b);
    expect((await notifications(b)).unread).toBe(0);
    const callId="9ad1078d-4c21-4679-9743-2b57e69e2ee0";
    await expect(sendCallSignal(a,{receiverId:c,callId,kind:"OFFER",payload:"{}"})).rejects.toBeInstanceOf(AuthorizationError);
    const signal=await sendCallSignal(a,{receiverId:b,callId,kind:"OFFER",payload:"{}"});
    expect(signal.kind).toBe("OFFER");
    const received=await receiveCallSignals(b,new Date(Date.now()-3000));
    expect(received.map(s=>s.callId)).toContain(callId);
    expect(await receiveCallSignals(c,new Date(Date.now()-3000))).toEqual([]);
  });
});