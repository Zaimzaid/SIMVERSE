import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import {
  getMyFoundingApplicationReadiness, submitMyFoundingCitizenshipApplication,
  withdrawMyFoundingCitizenshipApplication, getMyFoundingReviewQueue,
  denyFoundingCitizenshipApplication,
} from "./founding-citizenship-intake-service";
import { saveMyFoundingCitizenshipDraft } from "./founding-citizenship-draft-service";

let seq = 0;
async function member(label: string) {
  const value = await registerUser({
    displayName: label,
    email: `intake-${++seq}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  return value;
}
async function setUsername(userId: string, name: string) {
  await prisma.playerIdentity.update({ where: { userId }, data: { username: name } });
}
async function publish(countryName: string, xmin: number) {
  const steward = await member("Country steward");
  await prisma.fictionalPlanetSteward.create({
    data: { userId: steward.user.id, isActive: true, canPublish: true },
  });
  const country = await createFictionalCountryDraft(steward.user.id, steward.workspaceId, {
    name: countryName, color: "#38DCE4",
    geometry: { type: "Polygon", coordinates: [[
      [xmin, 0], [xmin + 5, 0], [xmin + 5, 5], [xmin, 5], [xmin, 0],
    ]] },
  });
  return publishFictionalCountry(steward.user.id, steward.workspaceId, country.id);
}

beforeEach(async () => resetDb());

describe("Phase 3B.1 application intake and review are locked independently of country publication", () => {
  it("never enables submission just because a user saved a draft", async () => {
    const u = await member("Draft holder");
    await saveMyFoundingCitizenshipDraft(u.user.id, { targetNationSlug: "valdora", motivation: "I want to contribute" });
    const before = await getMyFoundingApplicationReadiness(u.user.id);
    expect(before.stage).toBe("ACCOUNT_INCOMPLETE");
    expect(before.canSubmit).toBe(false);
    await setUsername(u.user.id, "intake_test1");
    const stillUnpublished = await getMyFoundingApplicationReadiness(u.user.id);
    expect(stillUnpublished.stage).toBe("NOT_PUBLISHED");
    await expect(submitMyFoundingCitizenshipApplication(u.user.id)).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.foundingCitizenshipApplication.count()).toBe(0);
    expect(await prisma.playerCitizenship.count()).toBe(0);
    expect(await prisma.playerVirtualDocument.count()).toBe(0);
  });

  it("requires an independently published founding country AND separately open intake", async () => {
    const u = await member("Applicant");
    await setUsername(u.user.id, "intake_test2");
    await saveMyFoundingCitizenshipDraft(u.user.id, { targetNationSlug: "arandia", motivation: "Community involvement" });
    const published = await publish("Arandia", 15);
    const closed = await getMyFoundingApplicationReadiness(u.user.id);
    expect(closed.stage).toBe("INTAKE_CLOSED");
    expect(closed.countryId).toBe(published.id);
    expect(closed.checks.find((c) => c.key === "published")?.met).toBe(true);
    expect(closed.checks.find((c) => c.key === "intake")?.met).toBe(false);
    await expect(submitMyFoundingCitizenshipApplication(u.user.id)).rejects.toBeInstanceOf(ConflictError);

    // No public API performs this sensitive activation. This is a test fixture
    // representing a separately provisioned, reviewed operator action.
    await prisma.foundingCitizenshipIntake.create({ data: { countryId: published.id, isOpen: true, policyVersion: 3 } });
    const ready = await getMyFoundingApplicationReadiness(u.user.id);
    expect(ready.canSubmit).toBe(true);
    expect(ready.stage).toBe("READY_TO_SUBMIT");
    const submitted = await submitMyFoundingCitizenshipApplication(u.user.id);
    expect(submitted.status).toBe("PENDING_REVIEW");
    expect(submitted.citizenshipGranted).toBe(false);
    expect(await prisma.foundingCitizenshipApplication.count()).toBe(1);
    expect((await prisma.foundingCitizenshipApplication.findUnique({ where: { userId: u.user.id } }))?.intakePolicyVersion).toBe(3);
    await expect(submitMyFoundingCitizenshipApplication(u.user.id)).rejects.toBeInstanceOf(ConflictError);
    expect((await getMyFoundingApplicationReadiness(u.user.id)).stage).toBe("ALREADY_SUBMITTED");
    expect(await prisma.playerCitizenship.count()).toBe(0);
    expect(await prisma.playerDocumentApplication.count()).toBe(0);
    expect(await prisma.playerVirtualDocument.count()).toBe(0);
  });

  it("lets only the applicant withdraw a pending application, retaining history", async () => {
    const u = await member("Withdrawal");
    await setUsername(u.user.id, "intake_test3");
    await saveMyFoundingCitizenshipDraft(u.user.id, { targetNationSlug: "valdora", motivation: "" });
    const country = await publish("Valdora", 0);
    await prisma.foundingCitizenshipIntake.create({ data: { countryId: country.id, isOpen: true } });
    await submitMyFoundingCitizenshipApplication(u.user.id);
    const result = await withdrawMyFoundingCitizenshipApplication(u.user.id);
    expect(result.status).toBe("WITHDRAWN");
    await expect(withdrawMyFoundingCitizenshipApplication(u.user.id)).rejects.toBeInstanceOf(ConflictError);
    expect((await getMyFoundingApplicationReadiness(u.user.id)).application?.status).toBe("WITHDRAWN");
    expect(await prisma.foundingCitizenshipApplication.count()).toBe(1);
    expect(await prisma.playerCitizenship.count()).toBe(0);
  });

  it("enforces country-scoped reviewer grants, prevents self-review, and never approves", async () => {
    const applicant = await member("Applicant");
    const reviewer = await member("Reviewer");
    const stranger = await member("Stranger");
    await setUsername(applicant.user.id, "intake_test4");
    await saveMyFoundingCitizenshipDraft(applicant.user.id, { targetNationSlug: "valdora", motivation: "Private statement visible only in authorized queue" });
    const valdora = await publish("Valdora", 0);
    const novara = await publish("Novara", 30);
    await prisma.foundingCitizenshipIntake.create({ data: { countryId: valdora.id, isOpen: true } });
    const app = await submitMyFoundingCitizenshipApplication(applicant.user.id);
    await expect(getMyFoundingReviewQueue(stranger.user.id)).rejects.toBeInstanceOf(AuthorizationError);
    await prisma.foundingCitizenshipReviewerGrant.create({ data: { userId: reviewer.user.id, countryId: novara.id, isActive: true } });
    expect((await getMyFoundingReviewQueue(reviewer.user.id)).applications).toHaveLength(0);
    await expect(denyFoundingCitizenshipApplication(reviewer.user.id, {
      applicationId: app.id, reviewNote: "Insufficient information supplied.",
    })).rejects.toBeInstanceOf(AuthorizationError);

    await prisma.foundingCitizenshipReviewerGrant.create({ data: { userId: reviewer.user.id, countryId: valdora.id, isActive: true } });
    const queue = await getMyFoundingReviewQueue(reviewer.user.id);
    expect(queue.applications).toHaveLength(1);
    expect(queue.applications[0]?.motivation).toContain("Private statement");
    expect(queue.canIssueCitizenship).toBe(false);
    await prisma.foundingCitizenshipReviewerGrant.create({ data: { userId: applicant.user.id, countryId: valdora.id, isActive: true } });
    await expect(denyFoundingCitizenshipApplication(applicant.user.id, {
      applicationId: app.id, reviewNote: "Trying to decide my own case.",
    })).rejects.toBeInstanceOf(AuthorizationError);
    const denied = await denyFoundingCitizenshipApplication(reviewer.user.id, {
      applicationId: app.id, reviewNote: "More details are needed before review.",
    });
    expect(denied.status).toBe("DENIED");
    expect(denied.citizenshipGranted).toBe(false);
    expect((await getMyFoundingReviewQueue(reviewer.user.id)).applications).toHaveLength(0);
    expect((await getMyFoundingApplicationReadiness(applicant.user.id)).application?.reviewNote).toContain("More details");
    await expect(denyFoundingCitizenshipApplication(reviewer.user.id, {
      applicationId: app.id, reviewNote: "Already reviewed and closed.",
    })).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.playerCitizenship.count()).toBe(0);
    expect(await prisma.playerVirtualDocument.count()).toBe(0);
  });

  it("rejects forged reviewer verdict fields and prevents pending applications in unavailable nations", async () => {
    const reviewer = await member("Deny test");
    await expect(denyFoundingCitizenshipApplication(reviewer.user.id, {
      applicationId: "fake", reviewNote: "This cannot be reviewed.", decision: "APPROVED",
    })).rejects.toBeInstanceOf(ValidationError);
    const u = await member("Unknown country");
    await setUsername(u.user.id, "intake_test5");
    await saveMyFoundingCitizenshipDraft(u.user.id, { targetNationSlug: "solandia", motivation: "" });
    await publish("Aurelia", 45);
    const r = await getMyFoundingApplicationReadiness(u.user.id);
    expect(r.countryId).toBeNull();
    expect(r.canSubmit).toBe(false);
    expect(await prisma.foundingCitizenshipApplication.count()).toBe(0);
  });
});
