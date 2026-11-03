import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import {
  clubEventDraftSchema, clubEventPolicy, clubEventReviewSchema, clubEventRsvpSchema,
} from "@/lib/civilization/district-club-event-contract";
import { recordAudit } from "./audit-service";
import { approvedHome, ensureClubModerator, ensureClubCanPost } from "./district-club-service";

export async function listMyDistrictClubEvents(userId: string) {
  const district = await approvedHome(userId);
  const now = new Date();
  const events = await prisma.districtClubEvent.findMany({
    where: {
      districtId: district.id,
      endsAt: { gt: now },
      OR: [
        { status: "PUBLISHED" },
        { organizerUserId: userId, status: "PENDING_REVIEW" },
      ],
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 60,
    include: {
      organizer: { select: { displayName: true } },
      rsvps: { where: { userId }, select: { userId: true } },
      _count: {
        select: {
          rsvps: {
            where: {
              user: {
                foundingResidence: { is: { districtId: district.id } },
                foundingPrimaryCitizenship: {
                  is: { status: "ACTIVE", countryId: district.countryId },
                },
              },
            },
          },
        },
      },
    },
  });
  return {
    district: { id: district.id, name: district.name },
    notice: "Online-only social activities. These events are not official Assembly votes, land projects or Vascoin rewards.",
    events: events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      category: event.category,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      reviewedAt: event.reviewedAt?.toISOString() ?? null,
      organizerDisplayName: event.organizer.displayName,
      status: event.status,
      attendanceCount: event._count.rsvps,
      myRsvp: event.rsvps.length > 0,
      mine: event.organizerUserId === userId,
    })),
  };
}

export async function submitDistrictClubEvent(userId: string, payload: unknown) {
  const input = parseOrThrow(clubEventDraftSchema, payload);
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  const now = Date.now();
  if (start.getTime() < now + clubEventPolicy.earliestStartMinutes * 60_000 ||
      start.getTime() > now + clubEventPolicy.latestStartDays * 86_400_000) {
    throw new ValidationError("Schedule events at least 30 minutes ahead and within the next 90 days.");
  }
  if (end.getTime() <= start.getTime() ||
      end.getTime() - start.getTime() > clubEventPolicy.maximumDurationHours * 3_600_000) {
    throw new ValidationError("The event must end after it begins, within six hours.");
  }
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubCanPost(userId, district.id, tx);
    const recent = await tx.districtClubEvent.count({
      where: { organizerUserId: userId, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    });
    if (recent >= clubEventPolicy.maximumProposalsPerWeek) {
      throw new ConflictError("You have reached the weekly limit of three event proposals.");
    }
    const event = await tx.districtClubEvent.create({
      data: {
        districtId: district.id,
        organizerUserId: userId,
        title: input.title,
        description: input.description,
        category: input.category,
        startsAt: start,
        endsAt: end,
        status: "PENDING_REVIEW",
      },
    });
    await recordAudit({
      action: "club.event_submitted",
      actorUserId: userId,
      entityType: "DistrictClubEvent",
      entityId: event.id,
      metadata: { districtId: district.id, category: event.category, status: event.status },
    }, tx);
    return { id: event.id, status: "PENDING_REVIEW" as const, publiclyVisible: false };
  });
}

export async function listMyClubEventReviewQueue(userId: string) {
  const district = await approvedHome(userId);
  await ensureClubModerator(userId, district.id);
  const events = await prisma.districtClubEvent.findMany({
    where: {
      districtId: district.id,
      OR: [
        { status: "PENDING_REVIEW" },
        { status: "PUBLISHED", endsAt: { gt: new Date() } },
      ],
    },
    include: { organizer: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" }, take: 50,
  });
  return {
    district: { id: district.id, name: district.name },
    events: events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      category: event.category,
      status: event.status,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      organizerDisplayName: event.organizer.displayName,
      mine: event.organizerUserId === userId,
    })),
  };
}

export async function reviewDistrictClubEvent(userId: string, payload: unknown) {
  const input = parseOrThrow(clubEventReviewSchema, payload);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubModerator(userId, district.id, tx);
    const event = await tx.districtClubEvent.findUnique({ where: { id: input.eventId } });
    if (!event || event.districtId !== district.id) {
      throw new NotFoundError("The event is not in your district.");
    }
    if (event.organizerUserId === userId) {
      throw new AuthorizationError("You cannot moderate your own club event.");
    }
    const isCancel = input.action === "CANCEL";
    if ((isCancel && event.status !== "PUBLISHED") ||
        (!isCancel && event.status !== "PENDING_REVIEW")) {
      throw new ConflictError("That event is no longer in a reviewable state.");
    }
    if (input.action === "PUBLISH" && event.startsAt.getTime() < Date.now() + 15 * 60_000) {
      throw new ConflictError("The event is too close to starting. Request a new event time.");
    }
    const status = input.action === "PUBLISH" ? "PUBLISHED" :
      input.action === "REJECT" ? "REJECTED" : "CANCELLED";
    await tx.districtClubEvent.update({
      where: { id: event.id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
        reviewReason: input.reason,
      },
    });
    if (isCancel) {
      await tx.districtClubEventRsvp.deleteMany({ where: { eventId: event.id } });
    }
    await recordAudit({
      action: "club.event_reviewed", actorUserId: userId,
      entityType: "DistrictClubEvent", entityId: event.id,
      metadata: { districtId: district.id, status },
    }, tx);
    return { id: event.id, status };
  });
}

export async function setMyDistrictClubEventRsvp(userId: string, payload: unknown) {
  const input = parseOrThrow(clubEventRsvpSchema, payload);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubCanPost(userId, district.id, tx);
    const event = await tx.districtClubEvent.findUnique({ where: { id: input.eventId } });
    if (!event || event.districtId !== district.id || event.status !== "PUBLISHED") {
      throw new NotFoundError("The event is not available in your district.");
    }
    if (input.rsvpAction === "JOIN") {
      if (event.startsAt.getTime() <= Date.now()) {
        throw new ConflictError("RSVP closes when the event starts.");
      }
      try {
        await tx.districtClubEventRsvp.create({ data: { eventId: event.id, userId } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictError("You have already joined this event.");
        }
        throw error;
      }
    } else {
      await tx.districtClubEventRsvp.deleteMany({
        where: { eventId: event.id, userId },
      });
    }
    await recordAudit({
      action: "club.event_rsvp_changed", actorUserId: userId,
      entityType: "DistrictClubEvent", entityId: event.id,
      metadata: { districtId: district.id, action: input.rsvpAction },
    }, tx);
    return { eventId: event.id, attending: input.rsvpAction === "JOIN" };
  });
}
