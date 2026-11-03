import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import { getMyDistrictClubHome, postMyDistrictClubMessage, listMyDistrictClubMessages } from "./district-club-service";
import { getMyClubSafety, issueClubSanction, submitClubAppeal, decideClubAppeal,
  getMyClubSafetyQueue, updateClubModeratorGrant } from "./district-club-safety-service";
import { getMyClubAlertSettings, saveMyClubAlertSettings, isQuietHour, clubLiveActivityMarker }
  from "./district-club-alert-service";
import { createMyClubInterestGroup, changeMyClubInterestMembership, listMyClubInterestGroups,
  sendMyClubInterestMessage, listMyClubInterestMessages, reportClubInterestMessage,
  listMyClubInterestModeration, moderateClubInterest } from "./district-club-interest-service";
import { getMyDistrictClubOperations } from "./district-club-operations-service";
import { submitDistrictClubEvent, reviewDistrictClubEvent, listMyDistrictClubEvents,
  setMyDistrictClubEventRsvp } from "./district-club-event-service";

let n = 0;
async function register(label: string) {
  return registerUser({
    displayName: label,
    email: "club-expansion-" + (++n) + "-" + Date.now() + "@example.com",
    password: "Password123", confirmPassword: "Password123",
  });
}
async function setup() {
  const steward = await register("Steward");
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
  const a = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "a", name: "District A",
      status: "ACTIVE", capacity: 100, activatedAt: new Date(),
      verifiedGeoVersionId: "approved-a" },
  });
  const b = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "b", name: "District B",
      status: "ACTIVE", capacity: 100, activatedAt: new Date(),
      verifiedGeoVersionId: "approved-b" },
  });
  return { steward: steward.user, country, a, b };
}
async function resident(countryId: string, districtId: string, label: string) {
  const person = (await register(label)).user;
  const app = await prisma.foundingCitizenshipApplication.create({
    data: { userId: person.id, countryId, submittedNationSlug: "valdora",
      status: "APPROVED", intakePolicyVersion: 1 },
  });
  await prisma.foundingPrimaryCitizenship.create({
    data: { userId: person.id, countryId, status: "ACTIVE", applicationId: app.id },
  });
  await prisma.foundingDistrictResidence.create({
    data: { userId: person.id, districtId },
  });
  return person;
}
async function moderator(countryId: string, districtId: string, label: string) {
  const person = await resident(countryId, districtId, label);
  await prisma.districtClubModeratorGrant.create({
    data: { userId: person.id, districtId, isActive: true },
  });
  return person;
}
function eventInput() {
  const start = new Date(Date.now() + 3 * 3_600_000);
  const end = new Date(start.getTime() + 3_600_000);
  return {
    title: "District friendly quiz competition",
    description: "Residents meet for an online quiz and community games.",
    category: "GAMES",
    capacity: 2,
    repeatWeeks: 1,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}
beforeEach(async () => resetDb());

describe("K4.4 Club restrictions, independent appeals and grants", () => {
  it("denies muted posting but allows private read and own appeals", async () => {
    const { country, a } = await setup();
    const person = await resident(country.id, a.id, "Resident");
    const moderatorA = await moderator(country.id, a.id, "Moderator A");
    const moderatorB = await moderator(country.id, a.id, "Moderator B");
    const sanction = await issueClubSanction(moderatorA.id, {
      targetUserId: person.id, kind: "MUTE", durationHours: 12,
      reason: "Repeatedly spamming other residents in several rooms.",
    });
    await expect(postMyDistrictClubMessage(person.id, {
      room: "GENERAL", body: "Another message",
    })).rejects.toBeInstanceOf(AuthorizationError);
    expect((await getMyDistrictClubHome(person.id)).active).toBe(true);
    expect((await getMyClubSafety(person.id)).sanctions[0]?.isActive).toBe(true);
    const appeal = await submitClubAppeal(person.id, {
      sanctionId: sanction.sanctionId,
      reason: "This was a misunderstanding; I would like a second review.",
    });
    await expect(decideClubAppeal(moderatorA.id, {
      appealId: appeal.appealId, decision: "OVERTURN",
      reason: "Second review of prior moderator's action.",
    })).rejects.toBeInstanceOf(AuthorizationError);
    expect((await getMyClubSafetyQueue(moderatorB.id)).appeals).toHaveLength(1);
    await decideClubAppeal(moderatorB.id, {
      appealId: appeal.appealId, decision: "OVERTURN",
      reason: "Additional evidence does not support this restriction.",
    });
    expect((await getMyClubSafety(person.id)).sanctions[0]?.isActive).toBe(false);
    await postMyDistrictClubMessage(person.id, {
      room: "GENERAL", body: "Glad to be back.",
    });
  });

  it("bans private Club access but leaves independent appeal endpoint available", async () => {
    const { country, a, b } = await setup();
    const target = await resident(country.id, a.id, "Resident");
    const moderatorA = await moderator(country.id, a.id, "Moderator");
    const outsider = await resident(country.id, b.id, "Other");
    await expect(issueClubSanction(moderatorA.id, {
      targetUserId: outsider.id, kind: "BAN", reason: "Repeated harassment of district members.",
      durationHours: 24,
    })).rejects.toBeInstanceOf(NotFoundError);
    await expect(issueClubSanction(moderatorA.id, {
      targetUserId: moderatorA.id, kind: "BAN", reason: "Self-restriction disallowed.",
      durationHours: 24,
    })).rejects.toBeInstanceOf(AuthorizationError);
    const banned = await issueClubSanction(moderatorA.id, {
      targetUserId: target.id, kind: "BAN", reason: "Repeated harassment of district members.",
      durationHours: 24,
    });
    expect((await getMyDistrictClubHome(target.id)).active).toBe(false);
    await expect(getMyDistrictClubOperations(target.id)).rejects.toBeInstanceOf(AuthorizationError);
    const appeal = await submitClubAppeal(target.id, {
      sanctionId: banned.sanctionId,
      reason: "Please review the supporting chat context and reinstate access.",
    });
    expect(appeal.status).toBe("OPEN");
  });

  it("limits moderator appointment to active stewards and eligible residents", async () => {
    const { steward, country, a, b } = await setup();
    const target = await resident(country.id, a.id, "Candidate");
    const outsider = await resident(country.id, b.id, "Elsewhere");
    await expect(updateClubModeratorGrant(target.id, {
      districtId: a.id, targetUserId: outsider.id, active: true,
      reason: "I want to appoint a moderator.",
    })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(updateClubModeratorGrant(steward.id, {
      districtId: a.id, targetUserId: outsider.id, active: true,
      reason: "District membership mismatch.",
    })).rejects.toBeInstanceOf(NotFoundError);
    await updateClubModeratorGrant(steward.id, {
      districtId: a.id, targetUserId: target.id, active: true,
      reason: "Approved for District Club moderation.",
    });
    expect((await prisma.districtClubModeratorGrant.findUnique({
      where: { userId_districtId: { userId: target.id, districtId: a.id } },
    }))?.isActive).toBe(true);
  });
});

describe("K4.5–K4.7 Club live signals, preferences and link sharing", () => {
  it("exposes only private preference data and validates quiet-hour boundaries", async () => {
    const { country, a } = await setup();
    const user = await resident(country.id, a.id, "Member");
    const defaults = await getMyClubAlertSettings(user.id);
    expect(defaults.chatAlerts).toBe(true);
    expect(defaults.capabilities.browserPush).toBe(false);
    await expect(saveMyClubAlertSettings(user.id, {
      chatAlerts: true, eventAlerts: true, quietStartHourUtc: 24, quietEndHourUtc: 7,
    })).rejects.toBeInstanceOf(ValidationError);
    await saveMyClubAlertSettings(user.id, {
      chatAlerts: false, eventAlerts: true, quietStartHourUtc: 22, quietEndHourUtc: 6,
    });
    const updated = await getMyClubAlertSettings(user.id);
    expect(updated.chatAlerts).toBe(false);
    expect(isQuietHour(new Date("2026-11-04T23:20:00Z"), 22, 6)).toBe(true);
    expect(isQuietHour(new Date("2026-11-04T09:20:00Z"), 22, 6)).toBe(false);
  });

  it("shares valid HTTPS media links without server fetching, and changes private live marker", async () => {
    const { country, a } = await setup();
    const author = await resident(country.id, a.id, "Author");
    const neighbor = await resident(country.id, a.id, "Neighbor");
    const initial = await clubLiveActivityMarker(neighbor.id);
    await expect(postMyDistrictClubMessage(author.id, {
      room: "GENERAL", body: "",
      mediaUrl: "http://localhost/private.png",
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(postMyDistrictClubMessage(author.id, {
      room: "GENERAL", body: "",
      mediaUrl: "https://example.com/document.pdf",
    })).rejects.toBeInstanceOf(ValidationError);
    await postMyDistrictClubMessage(author.id, {
      room: "GENERAL", body: "",
      mediaUrl: "https://example.com/farm-video.mp4",
    });
    const messages = await listMyDistrictClubMessages(neighbor.id, "GENERAL");
    expect(messages.messages[0]?.mediaUrl).toBe("https://example.com/farm-video.mp4");
    expect(await clubLiveActivityMarker(neighbor.id)).not.toBe(initial);
  });
});

describe("K4.8 district-only interest groups and independent report review", () => {
  it("gates membership, posting and private messages to current district residents", async () => {
    const { country, a, b } = await setup();
    const alice = await resident(country.id, a.id, "Alice");
    const bob = await resident(country.id, a.id, "Bob");
    const other = await resident(country.id, b.id, "Other");
    const created = await createMyClubInterestGroup(alice.id, {
      title: "Cooking Group",
      description: "Our neighborhood cooking tips and recipe conversations.",
    });
    expect((await listMyClubInterestGroups(bob.id)).groups).toHaveLength(1);
    expect((await listMyClubInterestGroups(other.id)).groups).toHaveLength(0);
    await expect(listMyClubInterestMessages(bob.id, created.groupId))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(changeMyClubInterestMembership(other.id, {
      groupId: created.groupId, action: "JOIN",
    })).rejects.toBeInstanceOf(NotFoundError);
    await changeMyClubInterestMembership(bob.id, { groupId: created.groupId, action: "JOIN" });
    await sendMyClubInterestMessage(alice.id, {
      groupId: created.groupId, body: "Welcome to our cooking circle.",
    });
    expect((await listMyClubInterestMessages(bob.id, created.groupId)).messages).toHaveLength(1);
    await expect(listMyClubInterestMessages(other.id, created.groupId))
      .rejects.toBeInstanceOf(NotFoundError);
    await changeMyClubInterestMembership(bob.id, { groupId: created.groupId, action: "LEAVE" });
    await expect(sendMyClubInterestMessage(bob.id, {
      groupId: created.groupId, body: "I should not be allowed.",
    })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("sends group-message reports to independent moderators", async () => {
    const { country, a } = await setup();
    const author = await resident(country.id, a.id, "Author");
    const reporter = await resident(country.id, a.id, "Reporter");
    const moderatorA = await moderator(country.id, a.id, "Moderator A");
    const created = await createMyClubInterestGroup(author.id, {
      title: "Learning Circle", description: "Residents studying together and exchanging ideas.",
    });
    await changeMyClubInterestMembership(reporter.id, {
      groupId: created.groupId, action: "JOIN",
    });
    const posted = await sendMyClubInterestMessage(author.id, {
      groupId: created.groupId, body: "Topic of the week: food production.",
    });
    const report = await reportClubInterestMessage(reporter.id, {
      messageId: posted.messageId, reason: "Reported for an independent moderation check.",
    });
    expect((await listMyClubInterestModeration(moderatorA.id)).reports).toHaveLength(1);
    await moderateClubInterest(moderatorA.id, {
      action: "HIDE", reportId: report.reportId,
    });
    expect((await listMyClubInterestMessages(reporter.id, created.groupId)).messages).toHaveLength(0);
    expect((await listMyClubInterestModeration(moderatorA.id)).reports).toHaveLength(0);
  });
});

describe("K4.9 and K4.11 weekly event series and moderation dashboard", () => {
  it("allows bounded weekly events with independent review and participant caps", async () => {
    const { country, a } = await setup();
    const author = await resident(country.id, a.id, "Organizer");
    const neighbor = await resident(country.id, a.id, "Neighbor");
    const third = await resident(country.id, a.id, "Third");
    const mod = await moderator(country.id, a.id, "Moderator");
    const series = await submitDistrictClubEvent(author.id, {
      ...eventInput(), repeatWeeks: 3,
    });
    expect(series.occurrences).toBe(3);
    expect(await prisma.districtClubEvent.count()).toBe(3);
    await expect(submitDistrictClubEvent(author.id, eventInput()))
      .rejects.toBeInstanceOf(ConflictError);
    const ids = series.ids;
    expect(ids).toHaveLength(3);
    await reviewDistrictClubEvent(mod.id, { eventId: ids[0], action: "PUBLISH" });
    await setMyDistrictClubEventRsvp(author.id, { eventId: ids[0], rsvpAction: "JOIN" });
    await setMyDistrictClubEventRsvp(neighbor.id, { eventId: ids[0], rsvpAction: "JOIN" });
    await expect(setMyDistrictClubEventRsvp(third.id, {
      eventId: ids[0], rsvpAction: "JOIN",
    })).rejects.toBeInstanceOf(ConflictError);
    const list = await listMyDistrictClubEvents(neighbor.id);
    expect(list.events[0]?.capacity).toBe(2);
    expect(list.events[0]?.occurrencesTotal).toBe(3);
    const stats = await getMyDistrictClubOperations(mod.id);
    expect(stats.metrics.pendingEventProposals).toBe(2);
    expect(stats.metrics.upcomingPublishedEvents).toBe(1);
    await expect(getMyDistrictClubOperations(neighbor.id))
      .rejects.toBeInstanceOf(AuthorizationError);
  });
});
