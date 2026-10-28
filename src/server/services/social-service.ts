import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { mediaUrlSchema, recordFriendInvite, recordFriendAccept, recordDirectMessage } from "./social-advanced-service";

export const nameQuery = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,23}$/);
export const messageSchema = z.object({
  recipientId: z.string().min(1).max(80),
  body: z.string().trim().max(1500).default(""),
  mediaUrl: mediaUrlSchema.optional(),
}).strict();
const targetSchema = z.object({ userId: z.string().min(1).max(80) }).strict();

export function friendshipKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}
async function requireNoBlock(a: string, b: string) {
  if (await prisma.socialBlock.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  })) throw new AuthorizationError("This connection is unavailable.");
}
async function requireFriend(a: string, b: string) {
  if (a === b) throw new ValidationError("Choose another player.");
  await requireNoBlock(a, b);
  const friend = await prisma.socialFriendship.findUnique({
    where: { pairKey: friendshipKey(a, b) },
  });
  if (friend?.status !== "ACCEPTED") throw new AuthorizationError("Both players must accept friendship before messaging.");
}
export async function searchPublicPlayers(userId: string, raw: unknown) {
  const q = nameQuery.safeParse(raw);
  if (!q.success) throw new ValidationError("Search for an exact public SIMVERSE username.");
  return prisma.playerIdentity.findMany({
    where: { username: q.data, profileVisibility: "PUBLIC", userId: { not: userId } },
    select: { userId: true, username: true, user: { select: { displayName: true, avatarUrl: true } } },
    take: 1,
  });
}
export async function listSocial(userId: string) {
  const [friendships, blocks] = await Promise.all([
    prisma.socialFriendship.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true, playerIdentity: { select: { username: true } } } },
        receiver: { select: { id: true, displayName: true, avatarUrl: true, playerIdentity: { select: { username: true } } } },
      }, orderBy: { updatedAt: "desc" }, take: 250,
    }),
    prisma.socialBlock.findMany({ where: { blockerId: userId }, select: {
      blockedId: true, blocked: { select: { id: true, displayName: true } },
    } }),
  ]);
  return {
    friends: friendships.filter(f => f.status === "ACCEPTED").map(f => ({
      id: f.id, other: f.senderId === userId ? f.receiver : f.sender,
    })),
    incoming: friendships.filter(f => f.status === "PENDING" && f.receiverId === userId).map(f => ({ id: f.id, other: f.sender })),
    outgoing: friendships.filter(f => f.status === "PENDING" && f.senderId === userId).map(f => ({ id: f.id, other: f.receiver })),
    blockedIds: blocks.map(b => b.blockedId),
    blocked: blocks.map(b => b.blocked),
  };
}
export async function requestFriend(userId: string, payload: unknown) {
  const target = targetSchema.safeParse(payload);
  if (!target.success) throw new ValidationError("Select a player to invite.");
  const id = target.data.userId;
  if (id === userId) throw new ValidationError("You cannot friend yourself.");
  // A recipient is discoverable only after explicitly making their profile PUBLIC.
  const discoverable = await prisma.playerIdentity.findFirst({
    where: { userId: id, username: { not: null }, profileVisibility: "PUBLIC" },
    select: { userId: true },
  });
  if (!discoverable) throw new NotFoundError("This player is not discoverable.");
  await requireNoBlock(userId, id);
  const key = friendshipKey(userId, id);
  if (await prisma.socialFriendship.findUnique({ where: { pairKey: key } }))
    throw new ConflictError("A friendship or request already exists.");
  const recent = await prisma.socialFriendship.count({ where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 3600000) } } });
  if (recent >= 15) throw new ValidationError("You have reached the hourly invitation limit.");
  try {
    const request = await prisma.socialFriendship.create({
      data: { pairKey: key, senderId: userId, receiverId: id },
      select: { id: true, status: true },
    });
    await recordFriendInvite(id);
    return request;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new ConflictError("This request already exists.");
    throw error;
  }
}
export async function respondFriend(userId: string, requestId: string, action: "ACCEPT" | "REMOVE") {
  if (action === "ACCEPT") {
    const pending = await prisma.socialFriendship.findFirst({ where: { id: requestId, receiverId: userId, status: "PENDING" } });
    if (!pending) throw new NotFoundError("You cannot accept this request.");
    await requireNoBlock(pending.senderId, pending.receiverId);
    const updated = await prisma.socialFriendship.updateMany({
      where: { id: pending.id, status: "PENDING", receiverId: userId }, data: { status: "ACCEPTED" },
    });
    if (updated.count === 0) throw new ConflictError("The request has changed.");
    await recordFriendAccept(pending.senderId);
    return;
  }
  const deleted = await prisma.socialFriendship.deleteMany({
    where: { id: requestId, OR: [{ senderId: userId }, { receiverId: userId }] },
  });
  if (!deleted.count) throw new NotFoundError("Connection not found.");
}
export async function blockPlayer(userId: string, payload: unknown) {
  const target = targetSchema.safeParse(payload);
  if (!target.success || target.data.userId === userId) throw new ValidationError("Choose another player.");
  const id = target.data.userId;
  if (!await prisma.user.findUnique({ where: { id }, select: { id: true } }))
    throw new NotFoundError("Player not found.");
  await prisma.$transaction([
    prisma.socialBlock.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: id } },
      create: { blockerId: userId, blockedId: id }, update: {},
    }),
    prisma.socialFriendship.deleteMany({ where: { pairKey: friendshipKey(userId, id) } }),
  ]);
}
export async function unblockPlayer(userId: string, targetId: string) {
  await prisma.socialBlock.deleteMany({ where: { blockerId: userId, blockedId: targetId } });
}
export async function listConversation(userId: string, recipientId: string) {
  await requireFriend(userId, recipientId);
  const messages = await prisma.socialMessage.findMany({
    where: { OR: [
      { senderId: userId, recipientId },
      { senderId: recipientId, recipientId: userId },
    ] },
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, body: true, mediaUrl: true, senderId: true, recipientId: true, createdAt: true, readAt: true,
      reactions:{select:{emoji:true,actorId:true}} },
  });
  await prisma.socialMessage.updateMany({
    where: { senderId: recipientId, recipientId: userId, readAt: null }, data: { readAt: new Date() },
  });
  return messages.reverse();
}
export async function sendMessage(userId: string, payload: unknown) {
  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success || (!parsed.data.body && !parsed.data.mediaUrl))
    throw new ValidationError("Write a message or include a supported HTTPS media URL.");
  const { recipientId, body, mediaUrl } = parsed.data;
  await requireFriend(userId, recipientId);
  const count = await prisma.socialMessage.count({
    where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 60000) } },
  });
  if (count >= 20) throw new ValidationError("Message limit reached. Try again shortly.");
  const message=await prisma.socialMessage.create({
    data: { senderId: userId, recipientId, body, mediaUrl },
    select: { id: true, senderId: true, recipientId: true, body: true, mediaUrl: true, createdAt: true, readAt: true },
  });
  await recordDirectMessage(recipientId);
  return message;
}
