import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { mediaUrlSchema, recordFriendInvite, recordFriendAccept, recordDirectMessage } from "./social-advanced-service";

export const nameQuery = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,23}$/);
export const messageSchema = z.object({
  recipientId: z.string().min(1).max(80),
  clientId: z.string().uuid().optional(),
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
export async function listConversation(userId: string, recipientId: string, beforeId?: string) {
  await requireFriend(userId, recipientId);
  const participants = { OR: [
    { senderId: userId, recipientId },
    { senderId: recipientId, recipientId: userId },
  ] };
  if (beforeId) {
    // Never allow a caller to page using an unrelated private message ID.
    const anchor = await prisma.socialMessage.findFirst({
      where: { id: beforeId, ...participants }, select: { id: true },
    });
    if (!anchor) throw new NotFoundError("Message not found in this conversation.");
  }
  const messages = await prisma.socialMessage.findMany({
    where: participants,
    ...(beforeId ? { cursor: { id: beforeId }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
    select: { id: true, body: true, mediaUrl: true, senderId: true, recipientId: true, createdAt: true, deliveredAt: true, readAt: true,
      reactions:{select:{emoji:true,actorId:true}} },
  });
  // Only acknowledge messages actually returned by this page. Previously a
  // single history fetch marked every older, unseen message as read.
  const receivedIds = messages
    .filter(message => message.senderId === recipientId && message.readAt === null)
    .map(message => message.id);
  if (receivedIds.length) {
    const readAt = new Date();
    await prisma.socialMessage.updateMany({
      where: { id: { in: receivedIds }, senderId: recipientId, recipientId: userId, readAt: null },
      data: { readAt },
    });
    for (const message of messages) {
      if (message.senderId === recipientId && message.readAt === null) message.readAt = readAt;
    }
  }
  return messages.reverse();
}
export async function sendMessage(userId: string, payload: unknown) {
  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success || (!parsed.data.body && !parsed.data.mediaUrl))
    throw new ValidationError("Write a message or include a supported HTTPS media URL.");
  const { recipientId, body, mediaUrl, clientId } = parsed.data;
  await requireFriend(userId, recipientId);
  const fields = { id: true, senderId: true, recipientId: true, clientId: true, body: true, mediaUrl: true, createdAt: true, deliveredAt: true, readAt: true } as const;
  const matches = (existing: {recipientId: string; body: string; mediaUrl: string | null}) =>
    existing.recipientId === recipientId && existing.body === body && existing.mediaUrl === (mediaUrl ?? null);
  // Return the original server-accepted message if a timeout causes a retry.
  // The original key must never be reused for different content or recipients.
  if (clientId) {
    const existing = await prisma.socialMessage.findUnique({
      where: { senderId_clientId: { senderId: userId, clientId } }, select: fields,
    });
    if (existing) {
      if (!matches(existing)) throw new ConflictError("This message request was already used for different content.");
      return existing;
    }
  }
  const count = await prisma.socialMessage.count({
    where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 60000) } },
  });
  if (count >= 20) throw new ValidationError("Message limit reached. Try again shortly.");
  let message;
  try {
    message = await prisma.socialMessage.create({
      data: { senderId: userId, recipientId, body, mediaUrl, clientId },
      select: fields,
    });
  } catch (error) {
    // The unique constraint arbitrates simultaneous retries across workers.
    if (clientId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.socialMessage.findUnique({
        where: { senderId_clientId: { senderId: userId, clientId } }, select: fields,
      });
      if (existing && matches(existing)) return existing;
      if (existing) throw new ConflictError("This message request was already used for different content.");
    }
    throw error;
  }
  // Notification is best effort; failures must not make a persisted message
  // look unsent and trigger duplicate retries from older clients.
  try { await recordDirectMessage(recipientId); } catch { /* message is persisted */ }
  return message;
}

/**
 * An explicit receiver acknowledgement. Fetching an inbox is not delivery:
 * the client must confirm receipt. Accept only caller-owned incoming IDs.
 * Unrelated IDs are ignored, and a repeated acknowledgement is idempotent.
 */
const deliverySchema = z.object({
  messageIds: z.array(z.string().min(1).max(80)).min(1).max(100),
}).strict();

export async function acknowledgeDirectDelivery(userId: string, payload: unknown) {
  const parsed = deliverySchema.safeParse(payload);
  if (!parsed.success) throw new ValidationError("Choose 1–100 valid messages.");
  const ids = [...new Set(parsed.data.messageIds)];
  const result = await prisma.socialMessage.updateMany({
    where: { id: { in: ids }, recipientId: userId, deliveredAt: null },
    data: { deliveredAt: new Date() },
  });
  return { acknowledged: result.count };
}
