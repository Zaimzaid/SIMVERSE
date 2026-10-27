import { Prisma } from "@prisma/client";
import { ConflictError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import {
  BUSINESS_SECTORS, ECONOMY_NOTICE, SIMVERSE_PROFESSIONS,
  businessDraftSchema, getProfession, normalizedBusinessName, selectedProfessionSchema,
} from "@/lib/player-identity/economy";
import { prisma } from "@/server/db/client";
import { ensurePlayerIdentity } from "./player-identity-service";
import { recordAudit } from "./audit-service";

async function requireUsername(userId: string) {
  const identity = await ensurePlayerIdentity(userId);
  if (!identity.username) {
    throw new ValidationError("Choose your unique SIMVERSE username in My Profile first.", [
      { path: "username", message: "Your account needs a SIMVERSE username." },
    ]);
  }
  return identity;
}

/** Never include real money, payout identifiers or private wallet information
 * in public /u/username. This is strictly authenticated, user-scoped data. */
export async function getMyEconomicIdentity(userId: string) {
  const identity = await ensurePlayerIdentity(userId);
  const [career, wallet, businesses] = await Promise.all([
    prisma.playerCareerProfile.findUnique({
      where: { identityId: identity.id },
      select: { professionCode: true, selectedAt: true },
    }),
    prisma.playerVirtualWallet.findUnique({
      where: { identityId: identity.id },
      select: {
        balance: true, currency: true,
        entries: {
          select: { id: true, kind: true, amount: true, balanceAfter: true, createdAt: true },
          orderBy: { createdAt: "desc" }, take: 25,
        },
      },
    }),
    prisma.playerVirtualBusiness.findMany({
      where: { identityId: identity.id },
      select: {
        id: true, name: true, sector: true, status: true,
        description: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
  ]);
  return {
    profession: career ? {
      ...career, ...getProfession(career.professionCode),
    } : null,
    usernameSet: Boolean(identity.username),
    wallet: wallet ?? { balance: 0, currency: "SVC", entries: [] },
    businesses,
    professionOptions: SIMVERSE_PROFESSIONS,
    sectorOptions: BUSINESS_SECTORS,
    notice: ECONOMY_NOTICE,
  };
}

/** One-time career setup + one initial grant are an indivisible operation.
 * Concurrent requests may yield a 409, but never a second reward or wallet.
 * No exposed API can directly set balance, select an amount, or mint credits.
 */
export async function selectMyProfession(userId: string, raw: unknown) {
  const { professionCode } = parseOrThrow(selectedProfessionSchema, raw);
  const profession = getProfession(professionCode);
  if (!profession) throw new ValidationError("Choose a profession from the SIMVERSE catalog.");
  const identity = await requireUsername(userId);
  const previous = await prisma.playerCareerProfile.findUnique({
    where: { identityId: identity.id }, select: { id: true },
  });
  if (previous) throw new ConflictError("Your starter profession is already selected. Career changes are not yet available.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.playerCareerProfile.create({
        data: { identityId: identity.id, professionCode: profession.code },
      });
      const wallet = await tx.playerVirtualWallet.create({
        data: {
          identityId: identity.id, currency: "SVC", balance: profession.startingCredits,
        },
      });
      await tx.playerWalletEntry.create({
        data: {
          walletId: wallet.id,
          eventKey: `STARTER:${identity.id}`,
          kind: "STARTER_GRANT",
          amount: profession.startingCredits,
          balanceAfter: profession.startingCredits,
        },
      });
      await recordAudit({
        action: "player.economy.profession_selected", actorUserId: userId,
        entityType: "PlayerCareerProfile", entityId: identity.id,
        metadata: { professionCode, starterCredits: profession.startingCredits, unit: "SVC" },
      }, tx);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Starter profession or credits have already been created for this player.");
    }
    throw error;
  }
  return getMyEconomicIdentity(userId);
}

/** Creating a fictional draft is NOT an approved business registration;
 * no permits, state authorization, payment privileges or merchant access.
 */
export async function createMyVirtualBusinessDraft(userId: string, raw: unknown) {
  const data = parseOrThrow(businessDraftSchema, raw);
  const identity = await requireUsername(userId);
  if (!await prisma.playerCareerProfile.findUnique({
    where: { identityId: identity.id }, select: { id: true },
  })) throw new ValidationError("Select your SIMVERSE career before creating a business draft.");
  const name = data.name.replace(/\s+/g, " ").trim();
  try {
    const business = await prisma.playerVirtualBusiness.create({
      data: {
        identityId: identity.id,
        name, nameKey: normalizedBusinessName(name),
        sector: data.sector, description: data.description, status: "DRAFT",
      },
      select: { id: true, name: true, status: true, sector: true, description: true, createdAt: true },
    });
    await recordAudit({
      action: "player.economy.business_draft_created", actorUserId: userId,
      entityType: "PlayerVirtualBusiness", entityId: business.id,
      metadata: { sector: data.sector },
    });
    return { business, notice: ECONOMY_NOTICE };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("This virtual company name is already in use.");
    }
    throw error;
  }
}
