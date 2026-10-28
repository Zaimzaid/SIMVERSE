import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listSocial } from "@/server/services/social-service";

/**
 * Community V3 inbox. Only accepted connections from the authenticated user's
 * friend list are returned. Unread counts are computed across the full inbox,
 * while previews are bounded for this pilot.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    const social = await listSocial(user.id);
    const accepted = new Set(social.friends.map((friend) => friend.other.id));
    if (!accepted.size) return dataResponse({ conversations: [], unread: 0 });

    const [recent, unreadGroups] = await Promise.all([
      prisma.socialMessage.findMany({
        where: {
          OR: [{ senderId: user.id }, { recipientId: user.id }],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1500,
        select: {
          id: true, senderId: true, recipientId: true,
          body: true, mediaUrl: true, createdAt: true,
        },
      }),
      prisma.socialMessage.groupBy({
        by: ["senderId"],
        where: { recipientId: user.id, readAt: null },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(unreadGroups.map((item) => [item.senderId, item._count._all]));
    const latest = new Map<string, typeof recent[number]>();
    for (const message of recent) {
      const peer = message.senderId === user.id ? message.recipientId : message.senderId;
      if (accepted.has(peer) && !latest.has(peer)) latest.set(peer, message);
    }
    const conversations = social.friends.map((friend) => {
      const message = latest.get(friend.other.id);
      return {
        friendId: friend.other.id,
        name: friend.other.displayName,
        avatarUrl: friend.other.avatarUrl,
        username: friend.other.playerIdentity?.username ?? null,
        unread: counts.get(friend.other.id) ?? 0,
        latest: message ? {
          id: message.id,
          senderId: message.senderId,
          body: message.body || (message.mediaUrl ? "Shared media" : ""),
          createdAt: message.createdAt,
        } : null,
      };
    });
    conversations.sort((a, b) => {
      const aTime = a.latest ? new Date(a.latest.createdAt).getTime() : 0;
      const bTime = b.latest ? new Date(b.latest.createdAt).getTime() : 0;
      return bTime - aTime || a.name.localeCompare(b.name);
    });
    return dataResponse({
      conversations,
      unread: conversations.reduce((total, c) => total + c.unread, 0),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
