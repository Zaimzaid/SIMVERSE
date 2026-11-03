import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { joinOrTransferFoundingDistrict } from "./founding-residence-service";
import {
  getMyDistrictClubActivity, acknowledgeMyDistrictClubActivity,
} from "./district-club-activity-service";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import {
  getMyDistrictClubHome, listMyDistrictClubMessages,
  postMyDistrictClubMessage, reportDistrictClubMessage,
  listMyClubModerationQueue, reviewDistrictClubReport,
} from "./district-club-service";

let seq = 0;
async function member(name: string) {
  return registerUser({
    displayName: name,
    email: "club-" + (++seq) + "-" + Date.now() + "@example.com",
    password: "Password123", confirmPassword: "Password123",
  });
}
async function setup() {
  const steward = await member("Steward");
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
      verifiedGeoVersionId: "reviewed-test-fixture-only" },
  });
  const b = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "b", name: "District B",
      status: "ACTIVE", capacity: 100, activatedAt: new Date(),
      verifiedGeoVersionId: "reviewed-test-fixture-only" },
  });
  return { country, a, b };
}
async function resident(countryId: string, districtId: string, name: string) {
  const user = (await member(name)).user;
  const application = await prisma.foundingCitizenshipApplication.create({
    data: { userId: user.id, countryId, submittedNationSlug: "valdora",
      status: "APPROVED", intakePolicyVersion: 1 },
  });
  await prisma.foundingPrimaryCitizenship.create({
    data: { userId: user.id, countryId, applicationId: application.id, status: "ACTIVE" },
  });
  await prisma.foundingDistrictResidence.create({ data: { userId: user.id, districtId } });
  return user;
}
beforeEach(async () => resetDb());

describe("KAVANDRO District Club - private resident chat", () => {
  it("fails closed until official district residence is active", async () => {
    const outsider = (await member("Outsider")).user;
    const home = await getMyDistrictClubHome(outsider.id);
    expect(home.active).toBe(false);
    await expect(listMyDistrictClubMessages(outsider.id, "GENERAL"))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(postMyDistrictClubMessage(outsider.id, {
      room: "GENERAL", body: "Hello neighbors!",
    })).rejects.toBeInstanceOf(AuthorizationError);
    expect(await prisma.districtClubMessage.count()).toBe(0);
  });

  it("shows private rooms to same-district residents without invitations", async () => {
    const { country, a, b } = await setup();
    const alice = await resident(country.id, a.id, "Alice");
    const bob = await resident(country.id, a.id, "Bob");
    const outsider = await resident(country.id, b.id, "Other district");
    const club = await getMyDistrictClubHome(alice.id);
    expect(club.active).toBe(true);
    expect(club.rooms.map(x => x.key)).toEqual(["GENERAL", "INTRODUCTIONS", "ACTIVITIES", "INTERESTS"]);
    const message = await postMyDistrictClubMessage(alice.id, {
      room: "INTRODUCTIONS", body: "Hello everyone, I'm new to the district!",
    });
    expect(message.officialAssemblyAction).toBe(false);
    expect(message.vascoinGranted).toBe(false);
    const visible = await listMyDistrictClubMessages(bob.id, "INTRODUCTIONS");
    expect(visible.messages).toHaveLength(1);
    expect(visible.messages[0]?.authorDisplayName).toBe("Alice");
    expect(visible.messages[0]?.isMine).toBe(false);
    expect((await listMyDistrictClubMessages(outsider.id, "INTRODUCTIONS")).messages).toEqual([]);
    expect((await listMyDistrictClubMessages(bob.id, "GENERAL")).messages).toEqual([]);
    expect(await prisma.vascoinJournal.count()).toBe(0);
    expect(await prisma.socialGroup.count()).toBe(0);
  });

  it("refuses visitors, unverified geography and inactive citizenship", async () => {
    const { country, a } = await setup();
    const residentUser = await resident(country.id, a.id, "Resident");
    const visitor = (await member("Visitor")).user;
    await prisma.foundingVisit.create({
      data: { userId: visitor.id, countryId: country.id, districtId: a.id,
        expiresAt: new Date(Date.now() + 24 * 3_600_000) },
    });
    await expect(listMyDistrictClubMessages(visitor.id, "GENERAL"))
      .rejects.toBeInstanceOf(AuthorizationError);
    await prisma.foundingDistrict.update({ where: { id: a.id }, data: { verifiedGeoVersionId: null } });
    expect((await getMyDistrictClubHome(residentUser.id)).active).toBe(false);
    await expect(listMyDistrictClubMessages(residentUser.id, "GENERAL"))
      .rejects.toBeInstanceOf(ConflictError);
    await prisma.foundingDistrict.update({ where: { id: a.id },
      data: { verifiedGeoVersionId: "test-approved" } });
    await prisma.foundingPrimaryCitizenship.update({ where: { userId: residentUser.id },
      data: { status: "REVOKED" } });
    await expect(postMyDistrictClubMessage(residentUser.id, {
      room: "GENERAL", body: "This should not post",
    })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects forged district access, invalid rooms and fast repeat messages", async () => {
    const { country, a, b } = await setup();
    const alice = await resident(country.id, a.id, "Alice");
    for (const payload of [
      { room: "GENERAL", body: "Hey!", districtId: b.id },
      { room: "UNKNOWN", body: "Hey!" },
      { room: "GENERAL", body: "  " },
      { room: "GENERAL", body: "Too many fields", userId: "victim" },
    ]) {
      await expect(postMyDistrictClubMessage(alice.id, payload)).rejects.toBeInstanceOf(ValidationError);
    }
    await expect(listMyDistrictClubMessages(alice.id, "OTHER"))
      .rejects.toBeInstanceOf(ValidationError);
    await postMyDistrictClubMessage(alice.id, { room: "GENERAL", body: "Hello neighbors" });
    await expect(postMyDistrictClubMessage(alice.id, { room: "GENERAL", body: "Again immediately" }))
      .rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.districtClubMessage.count()).toBe(1);
  });

  it("reports and hides only after independent moderator review", async () => {
    const { country, a } = await setup();
    const alice = await resident(country.id, a.id, "Alice");
    const bob = await resident(country.id, a.id, "Bob");
    const mod = await resident(country.id, a.id, "Independent moderator");
    await prisma.districtClubModeratorGrant.create({
      data: { userId: mod.id, districtId: a.id, isActive: true },
    });
    const msg = await postMyDistrictClubMessage(alice.id, {
      room: "GENERAL", body: "A message that will be reported",
    });
    await expect(reportDistrictClubMessage(alice.id, {
      messageId: msg.id, reason: "My own message was reported",
    })).rejects.toBeInstanceOf(ConflictError);
    const report = await reportDistrictClubMessage(bob.id, {
      messageId: msg.id, reason: "Please review this message",
    });
    expect(report.hiddenAutomatically).toBe(false);
    expect((await listMyDistrictClubMessages(bob.id, "GENERAL")).messages).toHaveLength(1);
    await expect(reportDistrictClubMessage(bob.id, {
      messageId: msg.id, reason: "Another duplicate report",
    })).rejects.toBeInstanceOf(ConflictError);
    await expect(listMyClubModerationQueue(alice.id)).rejects.toBeInstanceOf(AuthorizationError);
    expect((await listMyClubModerationQueue(mod.id)).reports).toHaveLength(1);
    await expect(reviewDistrictClubReport(bob.id, {
      reportId: report.reportId, action: "HIDE",
    })).rejects.toBeInstanceOf(AuthorizationError);
    const review = await reviewDistrictClubReport(mod.id, { reportId: report.reportId, action: "HIDE" });
    expect(review.hidden).toBe(true);
    expect((await listMyDistrictClubMessages(bob.id, "GENERAL")).messages).toHaveLength(0);
    expect(await prisma.auditLog.count({ where: { action: "club.message_posted" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "club.message_reported" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "club.report_reviewed" } })).toBe(1);
    await expect(reviewDistrictClubReport(mod.id, { reportId: report.reportId, action: "HIDE" }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("denies club moderator self-review and cross-district moderation", async () => {
    const { country, a, b } = await setup();
    const alice = await resident(country.id, a.id, "Alice");
    const mod = await resident(country.id, a.id, "Moderator");
    const outsider = await resident(country.id, b.id, "Other district moderator");
    await prisma.districtClubModeratorGrant.createMany({ data: [
      { userId: mod.id, districtId: a.id, isActive: true },
      { userId: outsider.id, districtId: b.id, isActive: true },
    ] });
    const msg = await postMyDistrictClubMessage(alice.id, {
      room: "GENERAL", body: "Hello district club",
    });
    const report = await reportDistrictClubMessage(mod.id, {
      messageId: msg.id, reason: "Need somebody else to investigate",
    });
    await expect(reviewDistrictClubReport(mod.id, {
      reportId: report.reportId, action: "DISMISS",
    })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(reviewDistrictClubReport(outsider.id, {
      reportId: report.reportId, action: "HIDE",
    })).rejects.toBeInstanceOf(NotFoundError);
    expect((await listMyDistrictClubMessages(alice.id, "GENERAL")).messages).toHaveLength(1);
  });
});


describe("K4.3 residents-only unread room activity and cursor privacy", () => {
  it("counts only other residents' visible messages in the current approved district", async () => {
    const { country, a, b } = await setup();
    const alice = await resident(country.id, a.id, "Alice");
    const bob = await resident(country.id, a.id, "Bob");
    const carol = await resident(country.id, a.id, "Carol");
    const visitor = (await member("Not assigned")).user;
    const outsider = await resident(country.id, b.id, "Other district");
    await expect(getMyDistrictClubActivity(visitor.id)).rejects.toBeInstanceOf(AuthorizationError);
    const first = await postMyDistrictClubMessage(alice.id, {
      room: "GENERAL", body: "Welcome to our district!",
    });
    await postMyDistrictClubMessage(carol.id, {
      room: "INTRODUCTIONS", body: "Hello to the neighborhood!",
    });
    const status = await getMyDistrictClubActivity(bob.id);
    expect(status.roomUnread.GENERAL).toBe(1);
    expect(status.roomUnread.INTRODUCTIONS).toBe(1);
    expect(status.totalUnread).toBe(2);
    expect(status.transport).toBe("CONDITIONAL_POLLING");
    expect((await getMyDistrictClubActivity(alice.id)).roomUnread.GENERAL).toBe(0);
    expect((await getMyDistrictClubActivity(outsider.id)).totalUnread).toBe(0);
    await expect(acknowledgeMyDistrictClubActivity(outsider.id, {
      channel: "GENERAL", itemId: first.id,
    })).rejects.toBeInstanceOf(NotFoundError);
    await acknowledgeMyDistrictClubActivity(bob.id, {
      channel: "GENERAL", itemId: first.id,
    });
    const after = await getMyDistrictClubActivity(bob.id);
    expect(after.roomUnread.GENERAL).toBe(0);
    expect(after.roomUnread.INTRODUCTIONS).toBe(1);
    expect(after.totalUnread).toBe(1);
    expect(JSON.stringify(after)).not.toContain(alice.email);
    expect(JSON.stringify(after)).not.toContain(alice.id);
    expect(await prisma.vascoinJournal.count()).toBe(0);
  });

  it("rejects forged channels and item IDs and never moves a read cursor backwards", async () => {
    const { country, a } = await setup();
    const alice = await resident(country.id, a.id, "Alice");
    const bob = await resident(country.id, a.id, "Bob");
    const earlier = await prisma.districtClubMessage.create({
      data: {
        districtId: a.id, authorUserId: alice.id, room: "GENERAL",
        body: "First announcement", status: "VISIBLE",
        createdAt: new Date(Date.now() - 30_000),
      },
    });
    const later = await prisma.districtClubMessage.create({
      data: {
        districtId: a.id, authorUserId: alice.id, room: "GENERAL",
        body: "Second announcement", status: "VISIBLE",
        createdAt: new Date(Date.now() - 15_000),
      },
    });
    await expect(acknowledgeMyDistrictClubActivity(bob.id, {
      channel: "INVALID", itemId: later.id,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(acknowledgeMyDistrictClubActivity(bob.id, {
      channel: "INTRODUCTIONS", itemId: later.id,
    })).rejects.toBeInstanceOf(NotFoundError);
    await expect(acknowledgeMyDistrictClubActivity(bob.id, {
      channel: "GENERAL", itemId: "x".repeat(25), districtId: a.id,
    })).rejects.toBeInstanceOf(ValidationError);
    await acknowledgeMyDistrictClubActivity(bob.id, { channel: "GENERAL", itemId: later.id });
    await acknowledgeMyDistrictClubActivity(bob.id, { channel: "GENERAL", itemId: earlier.id });
    const cursor = await prisma.districtClubReadCursor.findUnique({
      where: { userId_districtId_channel: {
        userId: bob.id, districtId: a.id, channel: "GENERAL",
      } },
    });
    expect(cursor?.lastSeenId).toBe(later.id);
    expect((await getMyDistrictClubActivity(bob.id)).roomUnread.GENERAL).toBe(0);
    await prisma.districtClubMessage.update({
      where: { id: later.id }, data: { status: "HIDDEN" },
    });
    await expect(acknowledgeMyDistrictClubActivity(bob.id, {
      channel: "GENERAL", itemId: later.id,
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("erases old room read state when approved residence transfers", async () => {
    const { country, a, b } = await setup();
    const alice = await resident(country.id, a.id, "Alice");
    const bob = await resident(country.id, a.id, "Bob");
    const message = await postMyDistrictClubMessage(alice.id, {
      room: "GENERAL", body: "Hello from our former district",
    });
    await acknowledgeMyDistrictClubActivity(bob.id, {
      channel: "GENERAL", itemId: message.id,
    });
    expect(await prisma.districtClubReadCursor.count({ where: { userId: bob.id } })).toBe(1);
    await prisma.foundingDistrictResidence.update({
      where: { userId: bob.id },
      data: { lastTransferAt: new Date(Date.now() - 31 * 86_400_000) },
    });
    await prisma.foundingDistrict.update({ where: { id: a.id }, data: { occupied: 1 } });
    await joinOrTransferFoundingDistrict(bob.id, b.id);
    expect(await prisma.districtClubReadCursor.count({ where: { userId: bob.id } })).toBe(0);
    expect((await getMyDistrictClubActivity(bob.id)).totalUnread).toBe(0);
    await expect(acknowledgeMyDistrictClubActivity(bob.id, {
      channel: "GENERAL", itemId: message.id,
    })).rejects.toBeInstanceOf(NotFoundError);
  });
});
