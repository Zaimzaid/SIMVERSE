import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { readEarthGeographyBundle } from "@/lib/earth/import";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { importEarthGeography, importEarthGeographyBundle } from "./earth-geography-import-service";
import { updateMyPlayerIdentity } from "./player-identity-service";
import {
  reviewVirtualDocumentApplication, submitVirtualDocumentApplication,
} from "./player-document-service";
import {
  checkMyVirtualTravel, getMyVirtualTravelCenter, getVirtualTravelReviewQueue,
  reviewVirtualTravelVisa, submitVirtualTravelVisa,
} from "./player-travel-service";

let sequence = 0;
async function player(prefix: string) {
  sequence++;
  return registerUser({
    email: `${prefix}-travel-${sequence}@example.com`,
    displayName: `Travel ${prefix}`, password: "Password123", confirmPassword: "Password123",
  });
}
async function fixture() {
  const applicant = await player("applicant");
  const originReviewer = await player("origin-reviewer");
  const destReviewer = await player("destination-reviewer");
  await importEarthGeography(prisma);
  const syntheticBundle = await readEarthGeographyBundle(
    process.cwd(), "test/fixtures/earth/synthetic-second-country/manifest.json",
  );
  await importEarthGeographyBundle(prisma, syntheticBundle);
  const origin = await prisma.earthGeoPlace.findFirstOrThrow({
    where: { kind: "COUNTRY", isoAlpha2: "NG" },
  });
  const destination = await prisma.earthGeoPlace.findFirstOrThrow({
    where: { kind: "COUNTRY", isoAlpha2: "CA" },
  });
  await updateMyPlayerIdentity(applicant.user.id, {
    username: `traveler_${sequence}`,
    displayName: "Pilot Traveler", avatarUrl: "", bannerUrl: "",
    creatorName: "", biography: "", profileVisibility: "PRIVATE",
    experienceMode: "PLAYER", homeCountryId: origin.id,
  });
  await prisma.playerDocumentReviewer.createMany({ data: [
    { userId: originReviewer.user.id, countryPlaceId: origin.id, isActive: true },
    { userId: destReviewer.user.id, countryPlaceId: destination.id, isActive: true },
  ] });
  return { applicant, originReviewer, destReviewer, origin, destination };
}

async function issuePassport(context: Awaited<ReturnType<typeof fixture>>) {
  const citizenship = await submitVirtualDocumentApplication(context.applicant.user.id, {
    kind: "CITIZENSHIP", countryPlaceId: context.origin.id,
  });
  await reviewVirtualDocumentApplication(context.originReviewer.user.id, citizenship.application.id, {
    decision: "APPROVE", note: "Qualified in SIMVERSE fictional pilot.",
  });
  const passport = await submitVirtualDocumentApplication(context.applicant.user.id, {
    kind: "INTERNATIONAL_PASSPORT", countryPlaceId: context.origin.id,
  });
  await reviewVirtualDocumentApplication(context.originReviewer.user.id, passport.application.id, {
    decision: "APPROVE", note: "Valid approved SIMVERSE virtual citizenship.",
  });
}

beforeEach(async () => { await resetDb(); });

describe("Phase 3: SIMVERSE fictional immigration and virtual travel security", () => {
  it("denies unconfigured routes and cannot turn profile selection into entry permissions", async () => {
    const ctx = await fixture();
    const checked = await checkMyVirtualTravel(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    });
    expect(checked.verdict.status).toBe("UNAVAILABLE");
    expect(checked.route).toBeNull();
    await expect(submitVirtualTravelVisa(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    })).rejects.toBeInstanceOf(ConflictError);
    const domestic = await checkMyVirtualTravel(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.origin.id,
    });
    expect(domestic.verdict.status).toBe("MISSING_REQUIREMENTS");
    expect(await prisma.playerTravelVisaApplication.count()).toBe(0);
  });

  it("does not allow application or approval before approved virtual passport and citizenship", async () => {
    const ctx = await fixture();
    await prisma.playerTravelRoutePolicy.create({
      data: {
        originCountryId: ctx.origin.id,
        destinationCountryId: ctx.destination.id,
        mode: "VISA_REQUIRED", isActive: true, passportKind: "INTERNATIONAL_PASSPORT",
      },
    });
    await expect(submitVirtualTravelVisa(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    })).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.playerTravelVisaApplication.count()).toBe(0);
  });

  it("passes through reviewed citizenship -> passport -> entry visa, then respects route changes", async () => {
    const ctx = await fixture();
    await issuePassport(ctx);
    const domestic = await checkMyVirtualTravel(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.origin.id,
    });
    expect(domestic.verdict.status).toBe("ELIGIBLE");
    const policy = await prisma.playerTravelRoutePolicy.create({
      data: {
        originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
        mode: "VISA_REQUIRED", passportKind: "INTERNATIONAL_PASSPORT", isActive: true,
      },
    });
    const preVisa = await checkMyVirtualTravel(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    });
    expect(preVisa.verdict.status).toBe("MISSING_REQUIREMENTS");
    expect(preVisa.verdict.checks.filter((check) => !check.met).map((check) => check.code)).toEqual(["visa"]);
    const visa = await submitVirtualTravelVisa(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
      purpose: "Visiting a fictional SIMVERSE experience.",
    });
    expect(visa.visa.status).toBe("PENDING_REVIEW");
    expect(visa.visa.serial).toBeNull();
    await expect(submitVirtualTravelVisa(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    })).rejects.toBeInstanceOf(ConflictError);
    const queue = await getVirtualTravelReviewQueue(ctx.destReviewer.user.id);
    expect(queue.applications.map((item) => item.id)).toContain(visa.visa.id);
    const approved = await reviewVirtualTravelVisa(ctx.destReviewer.user.id, visa.visa.id, {
      decision: "APPROVE", note: "Approved under the fictional SIMVERSE route pilot.",
    });
    expect(approved.visa.status).toBe("APPROVED");
    expect(approved.visa.serial).toMatch(/^SV-VISA-[A-F0-9]{24}$/);
    expect(approved.visa.displayStatus).toBe("VALID");
    const permitted = await checkMyVirtualTravel(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    });
    expect(permitted.verdict.status).toBe("ELIGIBLE");
    const own = await getMyVirtualTravelCenter(ctx.applicant.user.id);
    expect(own.visas).toHaveLength(1);
    expect(JSON.stringify(own)).not.toContain("passwordHash");
    await prisma.playerTravelRoutePolicy.update({
      where: { id: policy.id }, data: { isActive: false },
    });
    const closed = await checkMyVirtualTravel(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    });
    expect(closed.verdict.status).toBe("UNAVAILABLE");
  });

  it("enforces destination-scoped review, avoids self approval and rejects duplicate decisions", async () => {
    const ctx = await fixture();
    await issuePassport(ctx);
    await prisma.playerTravelRoutePolicy.create({
      data: {
        originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
        mode: "VISA_REQUIRED", isActive: true,
      },
    });
    const app = await submitVirtualTravelVisa(ctx.applicant.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    });
    await expect(reviewVirtualTravelVisa(ctx.originReviewer.user.id, app.visa.id, {
      decision: "APPROVE", note: "Wrong country reviewer privileges.",
    })).rejects.toBeInstanceOf(AuthorizationError);
    await prisma.playerDocumentReviewer.create({
      data: { userId: ctx.applicant.user.id, countryPlaceId: ctx.destination.id, isActive: true },
    });
    await expect(reviewVirtualTravelVisa(ctx.applicant.user.id, app.visa.id, {
      decision: "APPROVE", note: "Not permitted to approve my own virtual visa.",
    })).rejects.toBeInstanceOf(AuthorizationError);
    const denied = await reviewVirtualTravelVisa(ctx.destReviewer.user.id, app.visa.id, {
      decision: "DENY", note: "Missing specific eligibility under pilot policy.",
    });
    expect(denied.visa.status).toBe("DENIED");
    expect(denied.visa.serial).toBeNull();
    await expect(reviewVirtualTravelVisa(ctx.destReviewer.user.id, app.visa.id, {
      decision: "APPROVE", note: "Cannot override a reviewed application directly.",
    })).rejects.toBeInstanceOf(ConflictError);
  });
});
