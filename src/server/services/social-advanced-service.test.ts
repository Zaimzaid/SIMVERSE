import {beforeEach,describe,expect,it} from "vitest";
import {prisma} from "@/server/db/client";
import {AuthorizationError,NotFoundError,ValidationError} from "@/lib/errors";
import {registerUser} from "./auth-service";
import {resetDb} from "../../../test/helpers/db";
import {requestFriend,respondFriend,sendMessage,blockPlayer} from "./social-service";
import {createSocialGroup,listSocialGroups,respondGroupInvite,groupMessages,sendGroupMessage,
  reactToMessage,notifications,readNotifications,sendCallSignal,receiveCallSignals,
  inviteSocialGroupMembers,listSocialGroupMembers} from "./social-advanced-service";
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
  it("lets only an active group owner invite accepted friends, without duplicates",async()=>{
    const owner=await member(),first=await member(),second=await member(),stranger=await member();
    await befriend(owner,first);await befriend(owner,second);
    const group=await createSocialGroup(owner,{title:"Creators Club",invitees:[first]});
    await expect(listSocialGroupMembers(first,group.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(inviteSocialGroupMembers(first,group.id,{invitees:[second]}))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(inviteSocialGroupMembers(owner,group.id,{invitees:[stranger]}))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(inviteSocialGroupMembers(owner,group.id,{invitees:[first]}))
      .rejects.toThrow();
    const added=await inviteSocialGroupMembers(owner,group.id,{invitees:[second]});
    expect(added.invited).toBe(1);
    expect((await listSocialGroups(second))[0]?.status).toBe("INVITED");
    await expect(listSocialGroupMembers(second,group.id)).rejects.toBeInstanceOf(NotFoundError);
    await respondGroupInvite(second,group.id,"ACCEPT");
    const roster=await listSocialGroupMembers(second,group.id);
    expect(roster.map(item=>item.userId)).toEqual(expect.arrayContaining([owner,first,second]));
    expect(roster.find(item=>item.userId===second)?.status).toBe("ACTIVE");
    await expect(inviteSocialGroupMembers(owner,group.id,{invitees:[second]}))
      .rejects.toThrow();
    await expect(listSocialGroupMembers(stranger,group.id)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("paginates group history and rejects unrelated or hidden cursors",async()=>{
    const owner=await member(),joined=await member(),other=await member();
    await befriend(owner,joined);
    const group=await createSocialGroup(owner,{title:"History Team",invitees:[joined]});
    await respondGroupInvite(joined,group.id,"ACCEPT");
    const start=Date.now()-200000;
    await prisma.socialGroupMessage.createMany({data:Array.from({length:105},(_,i)=>({
      groupId:group.id,senderId:owner,body:`Group ${i}`,
      createdAt:new Date(start+i*1000),
    }))});
    const first=await groupMessages(joined,group.id);
    expect(first).toHaveLength(100);
    expect(first[0]?.body).toBe("Group 5");
    expect(first[99]?.body).toBe("Group 104");
    const second=await groupMessages(joined,group.id,first[0]!.id);
    expect(second.map(m=>m.body)).toEqual(["Group 0","Group 1","Group 2","Group 3","Group 4"]);
    const unrelated=await prisma.socialGroupMessage.create({data:{
      groupId:group.id,senderId:other,body:"Hidden cursor",
    }});
    await expect(groupMessages(joined,group.id,"missing-id")).rejects.toBeInstanceOf(NotFoundError);
    await expect(groupMessages(other,group.id)).rejects.toBeInstanceOf(NotFoundError);
    const separate=await createSocialGroup(owner,{title:"Separate Group",invitees:[joined]});
    const foreign=await prisma.socialGroupMessage.create({data:{
      groupId:separate.id,senderId:owner,body:"Private to another group",
    }});
    await expect(groupMessages(joined,group.id,foreign.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(unrelated.id).toBeTruthy();
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
  it("counts unread notifications beyond the 60-item preview",async()=>{
    const a=await member();
    await prisma.socialNotification.createMany({data:Array.from({length:75},(_,i)=>({
      userId:a,kind:"MESSAGE",title:`Alert ${i}`,detail:"A message arrived.",href:"/social",
    }))});
    const preview=await notifications(a);
    expect(preview.items).toHaveLength(60);
    expect(preview.unread).toBe(75);
    await readNotifications(a);
    expect((await notifications(a)).unread).toBe(0);
  });
  it("hides blocked members' reactions and rejects reactions to blocked messages",async()=>{
    const owner=await member(),viewer=await member(),blocked=await member();
    await befriend(owner,viewer);
    await befriend(owner,blocked);
    const group=await createSocialGroup(owner,{title:"Three Friends",invitees:[viewer,blocked]});
    await respondGroupInvite(viewer,group.id,"ACCEPT");
    await respondGroupInvite(blocked,group.id,"ACCEPT");
    const hidden=await sendGroupMessage(blocked,{groupId:group.id,body:"Hidden sender"});
    const visible=await sendGroupMessage(owner,{groupId:group.id,body:"Visible sender"});
    await reactToMessage(blocked,{kind:"GROUP",messageId:visible.id,emoji:"👍"});
    await blockPlayer(viewer,{userId:blocked});
    const history=await groupMessages(viewer,group.id);
    expect(history.map(m=>m.id)).not.toContain(hidden.id);
    expect(history.find(m=>m.id===visible.id)?.reactions).toEqual([]);
    await expect(reactToMessage(viewer,{kind:"GROUP",messageId:hidden.id,emoji:"❤️"}))
      .rejects.toBeInstanceOf(AuthorizationError);
    expect((await groupMessages(owner,group.id)).find(m=>m.id===visible.id)?.reactions)
      .toHaveLength(1);
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