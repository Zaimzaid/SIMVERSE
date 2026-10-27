import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { readEarthGeographyBundle } from "@/lib/earth/import";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { importEarthGeography, importEarthGeographyBundle } from "./earth-geography-import-service";
import { updateMyPlayerIdentity } from "./player-identity-service";
import {
  getMyVirtualDocuments, reviewVirtualDocumentApplication, submitVirtualDocumentApplication,
} from "./player-document-service";
import { checkMyVirtualTravel } from "./player-travel-service";
import {
  activateVirtualCitizenshipPolicy, approveVirtualTreaty, assessVirtualDualCitizenship,
  getMyVirtualCitizenshipQualification, getMyVirtualGovernance,
  proposeVirtualCitizenshipPolicy, proposeVirtualTreaty,
} from "./player-governance-service";

let sequence = 0;
async function account(prefix: string) {
  sequence++;
  return registerUser({
    displayName: prefix, email: `${prefix}-gov-${sequence}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
}
async function fixture() {
  const citizen = await account("citizen");
  const originAdmin = await account("origin-admin");
  const originApprover = await account("origin-approver");
  const destinationAdmin = await account("destination-admin");
  const destinationApprover = await account("destination-approver");
  await importEarthGeography(prisma);
  await importEarthGeographyBundle(prisma,
    await readEarthGeographyBundle(process.cwd(), "test/fixtures/earth/synthetic-second-country/manifest.json"));
  const origin = await prisma.earthGeoPlace.findFirstOrThrow({ where: { kind: "COUNTRY", isoAlpha2: "NG" } });
  const destination = await prisma.earthGeoPlace.findFirstOrThrow({ where: { kind: "COUNTRY", isoAlpha2: "CA" } });
  await updateMyPlayerIdentity(citizen.user.id, {
    username: `governor_traveler_${sequence}`, displayName: "SIMVERSE virtual traveler",
    avatarUrl: "", bannerUrl: "", creatorName: "", biography: "", profileVisibility: "PRIVATE",
    experienceMode: "PLAYER", homeCountryId: origin.id,
  });
  for (const [user, place, canActivate] of [
    [originAdmin, origin, false], [originApprover, origin, true],
    [destinationAdmin, destination, false], [destinationApprover, destination, true],
  ] as const) {
    await prisma.playerCountryGovernanceGrant.create({ data: {
      userId: user.user.id, countryPlaceId: place.id, isActive: true, canActivate,
    } });
  }
  await prisma.playerDocumentReviewer.createMany({ data: [
    { userId: originApprover.user.id, countryPlaceId: origin.id, isActive: true },
    { userId: destinationApprover.user.id, countryPlaceId: destination.id, isActive: true },
  ] });
  return { citizen, originAdmin, originApprover, destinationAdmin, destinationApprover, origin, destination };
}
type Context = Awaited<ReturnType<typeof fixture>>;

async function issueInitialCitizenshipAndPassport(ctx: Context) {
  const application = await submitVirtualDocumentApplication(ctx.citizen.user.id, {
    kind: "CITIZENSHIP", countryPlaceId: ctx.origin.id,
  });
  await reviewVirtualDocumentApplication(ctx.originApprover.user.id, application.application.id, {
    decision: "APPROVE", note: "Initial fictional home citizenship approved.",
  });
  const passport = await submitVirtualDocumentApplication(ctx.citizen.user.id, {
    kind: "INTERNATIONAL_PASSPORT", countryPlaceId: ctx.origin.id,
  });
  await reviewVirtualDocumentApplication(ctx.originApprover.user.id, passport.application.id, {
    decision: "APPROVE", note: "Approved SIMVERSE citizenship and pilot passport.",
  });
}

async function activatePolicy(ctx: Context, target: "origin" | "destination", days: number) {
  const [proposer, approver, country] = target === "origin"
    ? [ctx.originAdmin, ctx.originApprover, ctx.origin] as const
    : [ctx.destinationAdmin, ctx.destinationApprover, ctx.destination] as const;
  const { policy } = await proposeVirtualCitizenshipPolicy(proposer.user.id, {
    countryPlaceId: country.id, allowsDualCitizenship: true, minResidenceDays: days,
  });
  await activateVirtualCitizenshipPolicy(approver.user.id, policy.id);
}

beforeEach(async () => { await resetDb(); });

describe("SIMVERSE Phase 4 governance with country independence", () => {
  it("fails closed for second citizenship until both policies and valid residency exist", async () => {
    const ctx = await fixture();
    await issueInitialCitizenshipAndPassport(ctx);
    let preview = await getMyVirtualCitizenshipQualification(ctx.citizen.user.id, ctx.destination.id);
    expect(preview.assessment.eligible).toBe(false);
    await expect(submitVirtualDocumentApplication(ctx.citizen.user.id, {
      kind: "CITIZENSHIP", countryPlaceId: ctx.destination.id,
    })).rejects.toBeInstanceOf(ValidationError);
    await activatePolicy(ctx, "origin", 0);
    await activatePolicy(ctx, "destination", 0);
    preview = await getMyVirtualCitizenshipQualification(ctx.citizen.user.id, ctx.destination.id);
    expect(preview.assessment.eligible).toBe(false);
    expect(preview.assessment.checks.find((c) => c.code === "residency")?.met).toBe(false);
    const residence = await submitVirtualDocumentApplication(ctx.citizen.user.id, {
      kind: "RESIDENCY", countryPlaceId: ctx.destination.id,
    });
    await reviewVirtualDocumentApplication(ctx.destinationApprover.user.id, residence.application.id, {
      decision: "APPROVE", note: "Destination SIMVERSE virtual residency authorized.",
    });
    preview = await getMyVirtualCitizenshipQualification(ctx.citizen.user.id, ctx.destination.id);
    expect(preview.assessment.path).toBe("SECOND_CITIZENSHIP");
    expect(preview.assessment.eligible).toBe(true);
    const application = await submitVirtualDocumentApplication(ctx.citizen.user.id, {
      kind: "CITIZENSHIP", countryPlaceId: ctx.destination.id,
    });
    await reviewVirtualDocumentApplication(ctx.destinationApprover.user.id, application.application.id, {
      decision: "APPROVE", note: "Approved a second SIMVERSE virtual citizenship.",
    });
    expect((await getMyVirtualDocuments(ctx.citizen.user.id)).citizenships).toHaveLength(2);
    const assessment = await assessVirtualDualCitizenship(
      await prisma.playerIdentity.findUniqueOrThrow({ where: { userId: ctx.citizen.user.id } }),
      ctx.origin.id);
    expect(assessment.eligible).toBe(false);
    expect(assessment.path).toBe("ALREADY_CITIZEN");
  });

  it("denies self-activation and governance without explicitly scoped grants", async () => {
    const ctx = await fixture();
    await expect(getMyVirtualGovernance(ctx.citizen.user.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(proposeVirtualCitizenshipPolicy(ctx.citizen.user.id, {
      countryPlaceId: ctx.origin.id, allowsDualCitizenship: true, minResidenceDays: 30,
    })).rejects.toBeInstanceOf(AuthorizationError);
    const created = await proposeVirtualCitizenshipPolicy(ctx.originAdmin.user.id, {
      countryPlaceId: ctx.origin.id, allowsDualCitizenship: true, minResidenceDays: 90,
    });
    await expect(activateVirtualCitizenshipPolicy(ctx.originAdmin.user.id, created.policy.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(proposeVirtualCitizenshipPolicy(ctx.originAdmin.user.id, {
      countryPlaceId: ctx.origin.id, allowsDualCitizenship: false, minResidenceDays: 30,
    })).rejects.toBeInstanceOf(ConflictError);
    await activateVirtualCitizenshipPolicy(ctx.originApprover.user.id, created.policy.id);
    expect((await getMyVirtualGovernance(ctx.originApprover.user.id)).policies[0]?.status).toBe("ACTIVE");
  });

  it("requires two different country approvals before a bilateral virtual visa waiver takes effect", async () => {
    const ctx = await fixture();
    await issueInitialCitizenshipAndPassport(ctx);
    const before = await checkMyVirtualTravel(ctx.citizen.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    });
    expect(before.verdict.status).toBe("UNAVAILABLE");
    const proposal = await proposeVirtualTreaty(ctx.originAdmin.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    });
    expect(proposal.agreement.status).toBe("DRAFT");
    const originApproved = await approveVirtualTreaty(ctx.originApprover.user.id, proposal.agreement.id, {
      countryPlaceId: ctx.origin.id,
    });
    expect(originApproved.agreement.status).toBe("DRAFT");
    expect((await checkMyVirtualTravel(ctx.citizen.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    })).verdict.status).toBe("UNAVAILABLE");
    await expect(approveVirtualTreaty(ctx.originApprover.user.id, proposal.agreement.id, {
      countryPlaceId: ctx.destination.id,
    })).rejects.toBeInstanceOf(AuthorizationError);
    const activated = await approveVirtualTreaty(ctx.destinationApprover.user.id, proposal.agreement.id, {
      countryPlaceId: ctx.destination.id,
    });
    expect(activated.agreement.status).toBe("ACTIVE");
    const roundtrip = await checkMyVirtualTravel(ctx.citizen.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    });
    expect(roundtrip.verdict.status).toBe("ELIGIBLE");
    expect(roundtrip.route?.mode).toBe("VISA_WAIVER");
    const explicitClosure = await prisma.playerTravelRoutePolicy.create({
      data: { originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id, mode: "CLOSED" },
    });
    expect((await checkMyVirtualTravel(ctx.citizen.user.id, {
      originCountryId: ctx.origin.id, destinationCountryId: ctx.destination.id,
    })).verdict.status).toBe("UNAVAILABLE");
    await prisma.playerTravelRoutePolicy.delete({ where: { id: explicitClosure.id } });
    await expect(approveVirtualTreaty(ctx.destinationApprover.user.id, proposal.agreement.id, {
      countryPlaceId: ctx.destination.id,
    })).rejects.toBeInstanceOf(ConflictError);
  });
});
