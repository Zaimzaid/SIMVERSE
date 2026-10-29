import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { registerUser } from "./auth-service";
import { resetDb } from "../../../test/helpers/db";
import {
  friendshipKey, listConversation, listSocial, requestFriend, respondFriend,
  searchPublicPlayers, sendMessage, blockPlayer, unblockPlayer,
} from "./social-service";
import { socialActivityMarker } from "./social-live-service";

beforeEach(async()=>{ await resetDb(); });
let n=0;
async function account(name:string,publicProfile=true){
  n++;
  const value=await registerUser({displayName:`Player ${name}`,email:`social-${n}@example.com`,
    password:"Password123",confirmPassword:"Password123"});
  await prisma.playerIdentity.update({where:{userId:value.user.id},
    data:{username:`user_${n}`,profileVisibility:publicProfile?"PUBLIC":"PRIVATE"}});
  return value;
}
describe("consensual social messaging",()=>{
  it("finds only exact public profiles and refuses self invitations",async()=>{
    const a=await account("A"),b=await account("B"),c=await account("C",false);
    expect((await searchPublicPlayers(a.user.id,"user_2")).map(p=>p.userId)).toEqual([b.user.id]);
    expect(await searchPublicPlayers(a.user.id,"user_3")).toEqual([]);
    await expect(requestFriend(a.user.id,{userId:c.user.id})).rejects.toBeInstanceOf(NotFoundError);
    await expect(requestFriend(a.user.id,{userId:a.user.id})).rejects.toBeInstanceOf(ValidationError);
  });
  it("requires independent acceptance; only participants can view/send messages",async()=>{
    const a=await account("A"),b=await account("B"),c=await account("C");
    expect(friendshipKey(a.user.id,b.user.id)).toBe(friendshipKey(b.user.id,a.user.id));
    const invited=await requestFriend(a.user.id,{userId:b.user.id});
    await expect(sendMessage(a.user.id,{recipientId:b.user.id,body:"Hi"})).rejects.toBeInstanceOf(AuthorizationError);
    await expect(respondFriend(a.user.id,invited.id,"ACCEPT")).rejects.toBeInstanceOf(NotFoundError);
    await respondFriend(b.user.id,invited.id,"ACCEPT");
    const msg=await sendMessage(a.user.id,{recipientId:b.user.id,body:"Hello SIMVERSE"});
    expect(msg.body).toBe("Hello SIMVERSE");
    expect((await listConversation(b.user.id,a.user.id))[0]?.body).toBe("Hello SIMVERSE");
    await expect(listConversation(c.user.id,a.user.id)).rejects.toBeInstanceOf(AuthorizationError);
    expect((await listSocial(a.user.id)).friends).toHaveLength(1);
    await expect(requestFriend(b.user.id,{userId:a.user.id})).rejects.toBeInstanceOf(ConflictError);
  });
  it("marks only the 100 fetched messages as read and preserves older unread history",async()=>{
    const a=await account("A"),b=await account("B");
    const invite=await requestFriend(a.user.id,{userId:b.user.id});
    await respondFriend(b.user.id,invite.id,"ACCEPT");
    // Seed history directly to bypass the intentional 20-messages/minute send cap.
    const base=Date.now()-200000;
    await prisma.socialMessage.createMany({data:Array.from({length:105},(_,i)=>({
      senderId:b.user.id,recipientId:a.user.id,body:`History ${i}`,
      createdAt:new Date(base+i*1000),
    }))});
    const page=await listConversation(a.user.id,b.user.id);
    expect(page).toHaveLength(100);
    expect(page[0]?.body).toBe("History 5");
    expect(page[99]?.body).toBe("History 104");
    expect(page.every(message=>message.readAt!==null)).toBe(true);
    expect(await prisma.socialMessage.count({
      where:{senderId:b.user.id,recipientId:a.user.id,readAt:null},
    })).toBe(5);
    const oldest=page[0];
    expect(oldest).toBeDefined();
    if (!oldest) throw new Error("Missing first message on paged history.");
    const older=await listConversation(a.user.id,b.user.id,oldest.id);
    expect(older.map(message=>message.body)).toEqual([
      "History 0","History 1","History 2","History 3","History 4",
    ]);
    expect(await prisma.socialMessage.count({
      where:{senderId:b.user.id,recipientId:a.user.id,readAt:null},
    })).toBe(0);
    const c=await account("C");
    const unrelated=await prisma.socialMessage.create({data:{
      senderId:c.user.id,recipientId:a.user.id,body:"Private cursor",
    }});
    await expect(listConversation(a.user.id,b.user.id,unrelated.id))
      .rejects.toBeInstanceOf(NotFoundError);
  });
  it("retries the same direct send without duplication and rejects conflicting reuse",async()=>{
    const a=await account("Sender"),b=await account("Recipient");
    const invited=await requestFriend(a.user.id,{userId:b.user.id});
    await respondFriend(b.user.id,invited.id,"ACCEPT");
    const clientId="07e80fe4-29ba-4641-8226-3e601b1a2311";
    const first=await sendMessage(a.user.id,{recipientId:b.user.id,body:"One delivery",clientId});
    const second=await sendMessage(a.user.id,{recipientId:b.user.id,body:"One delivery",clientId});
    expect(second.id).toBe(first.id);
    expect(await prisma.socialMessage.count({where:{senderId:a.user.id,clientId}})).toBe(1);
    expect(await prisma.socialNotification.count({where:{userId:b.user.id,kind:"MESSAGE"}})).toBe(1);
    await expect(sendMessage(a.user.id,{recipientId:b.user.id,body:"Wrong payload",clientId}))
      .rejects.toBeInstanceOf(ConflictError);
    const legacy=await sendMessage(a.user.id,{recipientId:b.user.id,body:"Legacy without ID"});
    expect(legacy.id).not.toBe(first.id);
  });
  it("generates changing opaque activity markers for new messages and read receipts",async()=>{
    const a=await account("Sender"),b=await account("Recipient");
    const initial=await socialActivityMarker(a.user.id);
    const invited=await requestFriend(a.user.id,{userId:b.user.id});
    await respondFriend(b.user.id,invited.id,"ACCEPT");
    const afterFriend=await socialActivityMarker(a.user.id);
    expect(afterFriend).not.toBe(initial);
    const msg=await sendMessage(a.user.id,{recipientId:b.user.id,body:"Checking realtime",clientId:"f7686b59-65e4-4e51-9fb3-d82c3a9a02e4"});
    const afterSend=await socialActivityMarker(a.user.id);
    expect(afterSend).not.toBe(afterFriend);
    const beforeRead=await socialActivityMarker(a.user.id);
    await listConversation(b.user.id,a.user.id);
    const afterRead=await socialActivityMarker(a.user.id);
    expect(afterRead).not.toBe(beforeRead);
    expect(await prisma.socialMessage.findUnique({where:{id:msg.id},select:{readAt:true}}))
      .toEqual({readAt:expect.any(Date)});
  });
  it("blocking immediately revokes friend access, not historical message ownership",async()=>{
    const a=await account("A"),b=await account("B");
    const invite=await requestFriend(a.user.id,{userId:b.user.id});
    await respondFriend(b.user.id,invite.id,"ACCEPT");
    await sendMessage(a.user.id,{recipientId:b.user.id,body:"Before block"});
    await blockPlayer(b.user.id,{userId:a.user.id});
    expect((await listSocial(b.user.id)).friends).toHaveLength(0);
    await expect(sendMessage(a.user.id,{recipientId:b.user.id,body:"After block"})).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listConversation(a.user.id,b.user.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requestFriend(a.user.id,{userId:b.user.id})).rejects.toBeInstanceOf(AuthorizationError);
    await unblockPlayer(b.user.id,a.user.id);
    await expect(sendMessage(a.user.id,{recipientId:b.user.id,body:"Still unfriended"})).rejects.toBeInstanceOf(AuthorizationError);
  });
});
