import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { importEarthGeography } from "./earth-geography-import-service";
import { updateMyPlayerIdentity } from "./player-identity-service";
import {
  submitVirtualDocumentApplication, getMyVirtualDocuments,
  getVirtualDocumentReviewQueue, reviewVirtualDocumentApplication,
} from "./player-document-service";

let sequence = 0;
async function player(prefix: string) {
  sequence += 1;
  return registerUser({
    email: `${prefix}-docs-${sequence}@example.com`,
    displayName: `SIMVERSE ${prefix}`, password: "Password123", confirmPassword: "Password123",
  });
}

async function fixture() {
  const owner = await player("applicant");
  const reviewer = await player("reviewer");
  await importEarthGeography(prisma);
  const country = await prisma.earthGeoPlace.findFirstOrThrow({
    where: { kind: "COUNTRY", isoAlpha2: "NG" },
  });
  await updateMyPlayerIdentity(owner.user.id, {
    username: `virtual_${sequence}`, displayName: "SIMVERSE Applicant",
    creatorName: "", biography: "", bannerUrl: "", avatarUrl: "",
    profileVisibility: "PRIVATE", experienceMode: "PLAYER", homeCountryId: country.id,
  });
  return { owner, reviewer, country };
}

beforeEach(async () => { await resetDb(); });

describe("country-scoped SIMVERSE virtual document workflow", () => {
  it("rejects passport submission before approved virtual citizenship and never auto-approves", async () => {
    const { owner, country } = await fixture();
    await expect(submitVirtualDocumentApplication(owner.user.id, {
      kind: "INTERNATIONAL_PASSPORT", countryPlaceId: country.id,
    })).rejects.toBeInstanceOf(ValidationError);
    const { application } = await submitVirtualDocumentApplication(owner.user.id, {
      kind: "CITIZENSHIP", countryPlaceId: country.id, statement: "Virtual home country application",
    });
    expect(application.status).toBe("PENDING_REVIEW");
    expect(application.document).toBeNull();
    expect(await prisma.playerCitizenship.count()).toBe(0);
    expect(await prisma.playerVirtualDocument.count()).toBe(0);
    await expect(submitVirtualDocumentApplication(owner.user.id, {
      kind: "CITIZENSHIP", countryPlaceId: country.id,
    })).rejects.toBeInstanceOf(ConflictError);
  });

  it("requires a separate country reviewer and prevents self-review", async () => {
    const { owner, reviewer, country } = await fixture();
    const { application } = await submitVirtualDocumentApplication(owner.user.id, {
      kind: "CITIZENSHIP", countryPlaceId: country.id,
    });
    await expect(getVirtualDocumentReviewQueue(reviewer.user.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(reviewVirtualDocumentApplication(reviewer.user.id, application.id, {
      decision: "APPROVE", note: "Checked SIMVERSE pilot requirements.",
    })).rejects.toBeInstanceOf(AuthorizationError);
    await prisma.playerDocumentReviewer.create({
      data: { userId: owner.user.id, countryPlaceId: country.id, isActive: true },
    });
    await expect(reviewVirtualDocumentApplication(owner.user.id, application.id, {
      decision: "APPROVE", note: "Attempt to review my own application.",
    })).rejects.toBeInstanceOf(AuthorizationError);
    expect((await prisma.playerDocumentApplication.findUniqueOrThrow({
      where: { id: application.id },
    })).status).toBe("PENDING_REVIEW");
  });

  it("supports review -> citizenship -> national and international documents", async () => {
    const { owner, reviewer, country } = await fixture();
    const { application } = await submitVirtualDocumentApplication(owner.user.id, {
      kind: "CITIZENSHIP", countryPlaceId: country.id,
    });
    await prisma.playerDocumentReviewer.create({
      data: { userId: reviewer.user.id, countryPlaceId: country.id, isActive: true },
    });
    const queue = await getVirtualDocumentReviewQueue(reviewer.user.id);
    expect(queue.applications.map((a) => a.id)).toContain(application.id);
    const approved = await reviewVirtualDocumentApplication(reviewer.user.id, application.id, {
      decision: "APPROVE", note: "Qualified under the SIMVERSE fictional pilot.",
    });
    expect(approved.application.status).toBe("APPROVED");
    expect(await prisma.playerCitizenship.count({ where: { status: "ACTIVE" } })).toBe(1);
    await expect(reviewVirtualDocumentApplication(reviewer.user.id, application.id, {
      decision: "APPROVE", note: "Must not review twice.",
    })).rejects.toBeInstanceOf(ConflictError);
    for (const kind of ["NATIONAL_PASSPORT", "INTERNATIONAL_PASSPORT"] as const) {
      const submitted = await submitVirtualDocumentApplication(owner.user.id, {
        kind, countryPlaceId: country.id,
      });
      const reviewed = await reviewVirtualDocumentApplication(reviewer.user.id, submitted.application.id, {
        decision: "APPROVE", note: "Applicant has active fictional SIMVERSE citizenship.",
      });
      expect(reviewed.application.document?.serial).toMatch(/^SVV-[0-9A-F]{24}$/);
      expect(reviewed.application.document?.displayStatus).toBe("VALID");
    }
    expect(await prisma.playerVirtualDocument.count()).toBe(2);
    const me = await getMyVirtualDocuments(owner.user.id);
    expect(me.applications).toHaveLength(3);
    expect(me.citizenships).toHaveLength(1);
    expect(JSON.stringify(me)).not.toContain("passwordHash");
  });

  it("denial never issues virtual credentials and cannot be reopened by another reviewer", async () => {
    const { owner, reviewer, country } = await fixture();
    const submitted = await submitVirtualDocumentApplication(owner.user.id, {
      kind: "RESIDENCY", countryPlaceId: country.id, statement: "Test a virtual residency application",
    });
    await prisma.playerDocumentReviewer.create({
      data: { userId: reviewer.user.id, countryPlaceId: country.id, isActive: true },
    });
    const denied = await reviewVirtualDocumentApplication(reviewer.user.id, submitted.application.id, {
      decision: "DENY", note: "Pilot requires additional review documents.",
    });
    expect(denied.application.status).toBe("DENIED");
    expect(await prisma.playerVirtualDocument.count()).toBe(0);
    await expect(reviewVirtualDocumentApplication(reviewer.user.id, submitted.application.id, {
      decision: "APPROVE", note: "Reversal without permitted workflow.",
    })).rejects.toBeInstanceOf(ConflictError);
  });
});
