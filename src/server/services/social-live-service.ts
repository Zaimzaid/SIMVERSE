import { prisma } from "@/server/db/client";

/**
 * Privacy-preserving activity marker used by the M1 SSE pilot.
 * Only opaque activity fingerprints are compared; the stream never includes
 * message text, usernames, IDs, media, or notification details.
 *
 * Works across Next.js workers because persisted database rows are the source
 * of truth. This is bounded database polling, NOT a dedicated push broker.
 */
export async function socialActivityMarker(userId: string): Promise<string> {
  const [latestMessage, latestRead, latestAlert, latestFriend] = await Promise.all([
    prisma.socialMessage.findFirst({
      where: { OR: [{ senderId: userId }, { recipientId: userId }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    }),
    prisma.socialMessage.findFirst({
      where: { senderId: userId, readAt: { not: null } },
      orderBy: [{ readAt: "desc" }, { id: "desc" }],
      select: { id: true, readAt: true },
    }),
    prisma.socialNotification.findFirst({
      where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    }),
    prisma.socialFriendship.findFirst({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, status: true, updatedAt: true },
    }),
  ]);
  return [
    latestMessage?.id ?? "",
    latestRead?.id ?? "", latestRead?.readAt?.getTime() ?? "",
    latestAlert?.id ?? "",
    latestFriend?.id ?? "", latestFriend?.status ?? "",
    latestFriend?.updatedAt.getTime() ?? "",
  ].join("|");
}
