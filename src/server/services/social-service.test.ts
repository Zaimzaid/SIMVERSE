import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { registerUser } from "./auth-service";
import { resetDb } from "../../../test/helpers/db";
import {
  friendshipKey, listConversation, listSocial, requestFriend, respondFriend,
  searchPublicPlayers, sendMessage, blockPlayer, unblockPlayer,
} from "./social-service";

beforeEach(async()=>{ await resetDb(); });
let n=0;
async function account(name:string,publicProfile=true){
  n++;
  const value=await registerUser({displayName:name,email:`social-${n}@example.com`,
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
