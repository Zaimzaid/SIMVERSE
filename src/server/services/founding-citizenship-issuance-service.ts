import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { PLANET_ID } from "@/lib/planet/contracts";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";

const isCuid = (s: string) => /^[a-z0-9]{20,40}$/i.test(s);

/**
 * Only TWO independent active country-scoped reviewers can issue the first
 * fictional PRIMARY nationality, and only with an explicitly provisioned
 * operator issuance gate matching the intake policy revision. This has NO
 * relationship to the old EarthGeoPlace citizenship or passport document.
 */
export async function endorseFoundingCitizenship(reviewerId: string, applicationId: string) {
  if (!isCuid(applicationId)) throw new ValidationError("Invalid application identifier.");
  try {
    return await prisma.$transaction(async (tx) => {
      const app = await tx.foundingCitizenshipApplication.findUnique({ where: { id: applicationId } });
      if (!app || app.status !== "PENDING_REVIEW") throw new ConflictError("Application is not pending review.");
      if (app.userId === reviewerId) throw new AuthorizationError("Applicants cannot endorse themselves.");
      const [reviewer, gate, country, alreadyPrimary] = await Promise.all([
        tx.foundingCitizenshipReviewerGrant.findUnique({
          where: { userId_countryId: { userId: reviewerId, countryId: app.countryId } },
        }),
        tx.foundingCitizenshipIssuanceGate.findUnique({ where: { countryId: app.countryId } }),
        tx.fictionalCountry.findUnique({
          where: { id: app.countryId },
          select: { planetId: true, status: true, publishedVersionId: true,
            versions: { select: { id: true, slug: true } } },
        }),
        tx.foundingPrimaryCitizenship.findUnique({ where: { userId: app.userId } }),
      ]);
      if (!reviewer?.isActive) throw new AuthorizationError("Independent active country reviewer grant required.");
      if (!gate?.enabled || gate.policyVersion !== app.intakePolicyVersion) {
        throw new ConflictError("Issuance policy is closed or no longer matches the submitted application.");
      }
      const version = country?.versions.find((v) => v.id === country.publishedVersionId);
      if (!country || country.planetId !== PLANET_ID || country.status !== "PUBLISHED"
        || !version || version.slug !== app.submittedNationSlug) {
        throw new ConflictError("Published founding-country version does not match the application.");
      }
      if (alreadyPrimary) throw new ConflictError("This citizen already has a primary fictional nationality.");
      await tx.foundingCitizenshipApprovalVote.create({
        data: { applicationId: app.id, reviewerId },
      });
      const endorsements = await tx.foundingCitizenshipApprovalVote.count({ where: { applicationId: app.id } });
      if (endorsements < 2) {
        await recordAudit({
          action: "user.founding_citizenship_endorsed",
          actorUserId: reviewerId, entityType: "FoundingCitizenshipApplication",
          entityId: app.id, metadata: { countryId: app.countryId, endorsements },
        }, tx);
        return { applicationId: app.id, status: "PENDING_REVIEW" as const, endorsements, citizenshipGranted: false as const };
      }

      // Conditional status update and unique PRIMARY user key make repeat
      // issuance impossible even if two final reviewers race.
      const moved = await tx.foundingCitizenshipApplication.updateMany({
        where: { id: app.id, status: "PENDING_REVIEW" },
        data: { status: "APPROVED", reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewNote: "Two independently granted country reviewers endorsed." },
      });
      if (moved.count !== 1) throw new ConflictError("Application already changed.");
      await tx.foundingPrimaryCitizenship.create({
        data: { userId: app.userId, countryId: app.countryId, applicationId: app.id, status: "ACTIVE" },
      });
      await recordAudit({
        action: "user.founding_primary_citizenship_issued",
        actorUserId: reviewerId, entityType: "FoundingPrimaryCitizenship",
        entityId: app.userId, metadata: { countryId: app.countryId, applicationId: app.id, endorsements },
      }, tx);
      return { applicationId: app.id, status: "APPROVED" as const, endorsements, citizenshipGranted: true as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Duplicate endorsement or already issued primary citizenship.");
    }
    throw error;
  }
}

export async function getMyFoundingPrimaryCitizenship(userId: string) {
  const value = await prisma.foundingPrimaryCitizenship.findUnique({
    where: { userId },
    select: { countryId: true, issuedAt: true, status: true,
      country: { select: { name: true, status: true } },
    },
  });
  return {
    simversePrimaryNationality: value
      ? { countryId: value.countryId, countryName: value.country.name, status: value.status, issuedAt: value.issuedAt }
      : null,
    separateFromLegacyEarthCitizenship: true,
    // Optional additional nationality requires a distinct later policy.
    additionalNationalityAvailable: false,
  };
}
