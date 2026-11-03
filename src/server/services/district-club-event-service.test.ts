import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import { joinOrTransferFoundingDistrict } from "./founding-residence-service";
import {
  listMyDistrictClubEvents, submitDistrictClubEvent, listMyClubEventReviewQueue,
  reviewDistrictClubEvent, setMyDistrictClubEventRsvp,
} from "./district-club-event-service";

let seq = 0;
async function member(name: string) {
  return (await registerUser({
    displayName: name,
    email: "club-event-" + (++seq) + "-" + Date.now() + "@example.com",
    password: "Password123", confirmPassword: "Password123",
  })).user;
}
async function setup() {
  const steward = await registerUser({
    displayName: "Event steward",
    email: "club-event-steward-" + (++seq) + "-" + Date.now() + "@example.com",
    password: "Password123", confirmPassword: "Password123",
  });
  await prisma.fictionalPlanetSteward.create({
    data: { userId: steward.user.id, isActive: true, canPublish: true },
  });
  const draft = await createFictionalCountryDraft(steward.user.id, steward.workspaceId, {
    name: "Valdora", color: "#38DCE4",
    geometry: { type: "Polygon", coordinates: [[
      [0, 0], [5, 0], [5, 5], [0, 5], [0, 0],
    ]] },
  });
  const country = await publishFictionalCountry(steward.user.id, steward.workspaceId, draft.id);
  const first = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "a", name: "District One", status: "ACTIVE",
      capacity: 100, activatedAt: new Date(),
      verifiedGeoVersionId: "approved-test-fixture-one" },
  });
  const second = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "b", name: "District Two", status: "ACTIVE",
      capacity: 100, activatedAt: new Date(),
      verifiedGeoVersionId: "approved-test-fixture-two" },
  });
  return { country, first, second };
}
async function resident(countryId: string, districtId: string, label: string) {
  const user = await member(label);
  const app = await prisma.foundingCitizenshipApplication.create({
    data: { userId: user.id, countryId, submittedNationSlug: "valdora",
      intakePolicyVersion: 1, status: "APPROVED" },
  });
  await prisma.foundingPrimaryCitizenship.create({
    data: { userId: user.id, countryId, applicationId: app.id, status: "ACTIVE" },
  });
  await prisma.foundingDistrictResidence.create({ data: { userId: user.id, districtId } });
  return user;
}
function upcoming() {
  const start = new Date(Date.now() + 3 * 3_600_000);
  const end = new Date(start.getTime() + 3_600_000);
  return {
    title: "District trivia and games evening",
    description: "Meet other residents for friendly trivia, games and conversation.",
    category: "GAMES",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}
beforeEach(async () => resetDb());

describe("K4.2 approved non-3D District Club social events", () => {
  it("rejects proposals from visitors, outsiders and unapproved districts", async () => {
    const nobody = await member("Unassigned");
    await expect(listMyDistrictClubEvents(nobody.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(submitDistrictClubEvent(nobody.id, upcoming()))
      .rejects.toBeInstanceOf(AuthorizationError);
    const { country, first } = await setup();
    const alice = await resident(country.id, first.id, "Alice");
    await prisma.foundingDistrict.update({ where: { id: first.id }, data: { verifiedGeoVersionId: null } });
    await expect(submitDistrictClubEvent(alice.id, upcoming()))
      .rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.districtClubEvent.count()).toBe(0);
  });

  it("keeps pending proposals private and requires independent club moderation", async () => {
    const { country, first, second } = await setup();
    const author = await resident(country.id, first.id, "Author");
    const neighbor = await resident(country.id, first.id, "Neighbor");
    const other = await resident(country.id, second.id, "Other district");
    const moderator = await resident(country.id, first.id, "Moderator");
    await prisma.districtClubModeratorGrant.create({
      data: { userId: moderator.id, districtId: first.id, isActive: true },
    });
    const proposed = await submitDistrictClubEvent(author.id, upcoming());
    expect(proposed.status).toBe("PENDING_REVIEW");
    expect(proposed.publiclyVisible).toBe(false);
    expect((await listMyDistrictClubEvents(author.id)).events).toHaveLength(1);
    expect((await listMyDistrictClubEvents(neighbor.id)).events).toHaveLength(0);
    expect((await listMyDistrictClubEvents(other.id)).events).toHaveLength(0);
    await expect(listMyClubEventReviewQueue(neighbor.id)).rejects.toBeInstanceOf(AuthorizationError);
    expect((await listMyClubEventReviewQueue(moderator.id)).events).toHaveLength(1);
    await expect(reviewDistrictClubEvent(author.id, {
      eventId: proposed.id, action: "PUBLISH",
    })).rejects.toBeInstanceOf(AuthorizationError);
    const reviewed = await reviewDistrictClubEvent(moderator.id, {
      eventId: proposed.id, action: "PUBLISH",
    });
    expect(reviewed.status).toBe("PUBLISHED");
    expect((await listMyDistrictClubEvents(neighbor.id)).events).toHaveLength(1);
    expect((await listMyDistrictClubEvents(other.id)).events).toHaveLength(0);
    expect(await prisma.vascoinJournal.count()).toBe(0);
    expect(await prisma.districtAssemblyVote.count()).toBe(0);
  });

  it("supports RSVP and withdrawal without exposing attendee identities", async () => {
    const { country, first, second } = await setup();
    const author = await resident(country.id, first.id, "Author");
    const neighbor = await resident(country.id, first.id, "Neighbor");
    const other = await resident(country.id, second.id, "Other district");
    const mod = await resident(country.id, first.id, "Moderator");
    await prisma.districtClubModeratorGrant.create({
      data: { userId: mod.id, districtId: first.id, isActive: true },
    });
    const proposed = await submitDistrictClubEvent(author.id, upcoming());
    await expect(setMyDistrictClubEventRsvp(neighbor.id, {
      eventId: proposed.id, rsvpAction: "JOIN",
    })).rejects.toBeInstanceOf(NotFoundError);
    await reviewDistrictClubEvent(mod.id, { eventId: proposed.id, action: "PUBLISH" });
    await expect(setMyDistrictClubEventRsvp(other.id, {
      eventId: proposed.id, rsvpAction: "JOIN",
    })).rejects.toBeInstanceOf(NotFoundError);
    await setMyDistrictClubEventRsvp(neighbor.id, {
      eventId: proposed.id, rsvpAction: "JOIN",
    });
    const listing = await listMyDistrictClubEvents(neighbor.id);
    expect(listing.events[0]?.attendanceCount).toBe(1);
    expect(listing.events[0]?.myRsvp).toBe(true);
    expect(JSON.stringify(listing)).not.toContain(neighbor.email);
    expect(JSON.stringify(listing.events)).not.toContain(neighbor.id);
    await expect(setMyDistrictClubEventRsvp(neighbor.id, {
      eventId: proposed.id, rsvpAction: "JOIN",
    })).rejects.toBeInstanceOf(ConflictError);
    await setMyDistrictClubEventRsvp(neighbor.id, {
      eventId: proposed.id, rsvpAction: "LEAVE",
    });
    expect((await listMyDistrictClubEvents(neighbor.id)).events[0]?.attendanceCount).toBe(0);
    expect(await prisma.auditLog.count({
      where: { action: "club.event_rsvp_changed" },
    })).toBe(2);
  });

  it("prevents forged fields, invalid times and event spam", async () => {
    const { country, first, second } = await setup();
    const alice = await resident(country.id, first.id, "Alice");
    const draft = upcoming();
    const bad = [
      { ...draft, districtId: second.id },
      { ...draft, title: "Tiny" },
      { ...draft, category: "CONSTRUCTION" },
      { ...draft, startsAt: new Date(Date.now() + 10_000).toISOString() },
      { ...draft, endsAt: new Date(Date.now() - 1_000).toISOString() },
      { ...draft, endsAt: new Date(Date.now() + 20 * 3_600_000).toISOString() },
    ];
    for (const payload of bad) {
      await expect(submitDistrictClubEvent(alice.id, payload))
        .rejects.toBeInstanceOf(ValidationError);
    }
    for (let i = 0; i < 3; i++) {
      await submitDistrictClubEvent(alice.id, { ...draft, title: draft.title + " " + i });
    }
    await expect(submitDistrictClubEvent(alice.id, draft))
      .rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.districtClubEvent.count()).toBe(3);
  });

  it("cancels published gatherings and clears their RSVPs after review", async () => {
    const { country, first } = await setup();
    const author = await resident(country.id, first.id, "Author");
    const attendee = await resident(country.id, first.id, "Attendee");
    const mod = await resident(country.id, first.id, "Moderator");
    await prisma.districtClubModeratorGrant.create({
      data: { userId: mod.id, districtId: first.id, isActive: true },
    });
    const draft = await submitDistrictClubEvent(author.id, upcoming());
    await reviewDistrictClubEvent(mod.id, { eventId: draft.id, action: "PUBLISH" });
    expect((await listMyClubEventReviewQueue(mod.id)).events.some(x => x.id === draft.id)).toBe(true);
    await setMyDistrictClubEventRsvp(attendee.id, { eventId: draft.id, rsvpAction: "JOIN" });
    const cancelled = await reviewDistrictClubEvent(mod.id, {
      eventId: draft.id, action: "CANCEL", reason: "Not enough hosts to run the online meeting.",
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(await prisma.districtClubEventRsvp.count()).toBe(0);
    expect((await listMyDistrictClubEvents(attendee.id)).events).toHaveLength(0);
    await expect(setMyDistrictClubEventRsvp(attendee.id, {
      eventId: draft.id, rsvpAction: "JOIN",
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("clears RSVP when the citizen transfers and prevents self-review", async () => {
    const { country, first, second } = await setup();
    const alice = await resident(country.id, first.id, "Alice");
    const mod = await resident(country.id, first.id, "Moderator");
    await prisma.districtClubModeratorGrant.create({
      data: { userId: mod.id, districtId: first.id, isActive: true },
    });
    const published = await submitDistrictClubEvent(alice.id, upcoming());
    await reviewDistrictClubEvent(mod.id, { eventId: published.id, action: "PUBLISH" });
    await setMyDistrictClubEventRsvp(alice.id, { eventId: published.id, rsvpAction: "JOIN" });
    await expect(reviewDistrictClubEvent(alice.id, { eventId: published.id, action: "CANCEL" }))
      .rejects.toBeInstanceOf(AuthorizationError);
    await prisma.foundingDistrictResidence.update({
      where: { userId: alice.id },
      data: { lastTransferAt: new Date(Date.now() - 31 * 86_400_000) },
    });
    await prisma.foundingDistrict.update({ where: { id: first.id }, data: { occupied: 1 } });
    await joinOrTransferFoundingDistrict(alice.id, second.id);
    expect(await prisma.districtClubEventRsvp.count({
      where: { eventId: published.id, userId: alice.id },
    })).toBe(0);
    expect((await listMyDistrictClubEvents(alice.id)).events).toHaveLength(0);
  });
});
