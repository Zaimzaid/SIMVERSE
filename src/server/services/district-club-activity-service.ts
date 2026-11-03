import { Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { DISTRICT_CLUB_ROOMS } from "@/lib/civilization/district-club-contract";
import {
  clubActivityAcknowledgeSchema, clubActivityPolicy,
} from "@/lib/civilization/district-club-activity-contract";
import { approvedHome } from "./district-club-service";

const CHANNELS = DISTRICT_CLUB_ROOMS.map(room => room.key);
type ActivityChannel = typeof CHANNELS[number] | "EVENTS";

function newerThan(seenAt: Date, seenId: string) {
  return { OR: [
    { createdAt: { gt: seenAt } },
    { createdAt: seenAt, id: { gt: seenId } },
  ] };
}

export async function getMyDistrictClubActivity(userId: string) {
  const district = await approvedHome(userId);
  const [home, cursors] = await Promise.all([
    prisma.foundingDistrictResidence.findUniqueOrThrow({
      where: { userId }, select: { startedAt: true },
    }),
    prisma.districtClubReadCursor.findMany({
      where: { userId, districtId: district.id },
      select: { channel: true, lastSeenAt: true, lastSeenId: true },
    }),
  ]);
  const byChannel = new Map(cursors.map(cursor => [cursor.channel, cursor]));
  const roomCounts = await Promise.all(CHANNELS.map(async channel => {
    const marker = byChannel.get(channel);
    const count = await prisma.districtClubMessage.count({
      where: {
        districtId: district.id, room: channel, status: "VISIBLE",
        authorUserId: { not: userId },
        ...newerThan(marker?.lastSeenAt ?? home.startedAt, marker?.lastSeenId ?? ""),
      },
    });
    return { channel, count: Math.min(clubActivityPolicy.maxUnreadPerChannel, count) };
  }));
  const eventsMarker = byChannel.get("EVENTS");
  const seenAt = eventsMarker?.lastSeenAt ?? home.startedAt;
  const seenId = eventsMarker?.lastSeenId ?? "";
  const eventCount = await prisma.districtClubEvent.count({
    where: {
      districtId: district.id, status: "PUBLISHED", endsAt: { gt: new Date() },
      organizerUserId: { not: userId },
      OR: [
        { reviewedAt: { gt: seenAt } },
        { reviewedAt: seenAt, id: { gt: seenId } },
      ],
    },
  });
  const unreadRooms = Object.fromEntries(roomCounts.map(item => [item.channel, item.count])) as
    Record<(typeof CHANNELS)[number], number>;
  const events = Math.min(clubActivityPolicy.maxUnreadPerChannel, eventCount);
  const totalUnread = roomCounts.reduce((n, item) => n + item.count, 0) + events;
  return {
    district: { id: district.id, name: district.name },
    roomUnread: unreadRooms,
    eventUnread: events,
    totalUnread,
    refreshIntervalMs: clubActivityPolicy.refreshIntervalMs,
    transport: clubActivityPolicy.transport,
  };
}

/** Explicit read acknowledgement uses a server-verified, currently visible item
 * in the caller's *current* home district. Clients cannot forge timestamps or
 * mark beyond the item they actually received. Cursors never move backward.
 */
export async function acknowledgeMyDistrictClubActivity(userId: string, payload: unknown) {
  const { channel, itemId } = parseOrThrow(clubActivityAcknowledgeSchema, payload);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    let seenAt: Date;
    if (channel === "EVENTS") {
      const event = await tx.districtClubEvent.findFirst({
        where: { id: itemId, districtId: district.id, status: "PUBLISHED",
          endsAt: { gt: new Date() }, reviewedAt: { not: null } },
        select: { reviewedAt: true },
      });
      if (!event?.reviewedAt) throw new NotFoundError("This club event is not available.");
      seenAt = event.reviewedAt;
    } else {
      const message = await tx.districtClubMessage.findFirst({
        where: { id: itemId, districtId: district.id, room: channel, status: "VISIBLE" },
        select: { createdAt: true },
      });
      if (!message) throw new NotFoundError("This club room message is not available.");
      seenAt = message.createdAt;
    }
    const where = {
      userId_districtId_channel: { userId, districtId: district.id, channel },
    };
    try {
      await tx.districtClubReadCursor.create({
        data: {
          userId, districtId: district.id, channel,
          lastSeenAt: seenAt, lastSeenId: itemId,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002") throw error;
    }
    // Concurrent/out-of-order clients may only advance the cursor.
    await tx.districtClubReadCursor.updateMany({
      where: {
        userId, districtId: district.id, channel,
        OR: [
          { lastSeenAt: { lt: seenAt } },
          { lastSeenAt: seenAt, lastSeenId: { lt: itemId } },
        ],
      },
      data: { lastSeenAt: seenAt, lastSeenId: itemId },
    });
    return { channel: channel as ActivityChannel, accepted: true };
  });
}
