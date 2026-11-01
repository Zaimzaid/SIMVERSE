import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { PLANET_ID } from "@/lib/planet/contracts";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import {
  VASCOIN_DAILY_CLAIM, VASCOIN_DAILY_CONTRIBUTION_LIMIT,
  VASCOIN_MAX_CONTRIBUTIONS_PER_DAY, VASCOIN_POLICY_ID, VASCOIN_SUPPLY_CEILING,
  VASCOIN_ISSUER_ACCOUNT_ID, VASCOIN_UNIT, vascoinContributionSchema, vascoinNotice,
} from "@/lib/civilization/vascoin-contract";

const intMax = 2_147_483_647;
type Db = Prisma.TransactionClient | typeof prisma;

function utcDay(now: Date) { return now.toISOString().slice(0, 10); }
function utcStart(now: Date) { return new Date(`${utcDay(now)}T00:00:00.000Z`); }

async function personalAccount(userId: string, db: Db) {
  return db.vascoinAccount.upsert({
    where: { ownerUserId: userId },
    create: { ownerUserId: userId, kind: "CITIZEN", balance: 0 },
    update: {},
  });
}

async function approvedHome(userId: string, db: Db) {
  const [home, primary] = await Promise.all([
    db.foundingDistrictResidence.findUnique({
      where: { userId },
      include: { district: { include: { country: {
        select: { planetId: true, status: true, publishedVersionId: true },
      } } } },
    }),
    db.foundingPrimaryCitizenship.findUnique({ where: { userId } }),
  ]);
  if (!home || !primary || primary.status !== "ACTIVE" ||
    home.district.countryId !== primary.countryId ||
    home.district.status !== "ACTIVE" || !home.district.activatedAt ||
    !home.district.verifiedGeoVersionId || home.district.country.planetId !== PLANET_ID ||
    home.district.country.status !== "PUBLISHED" ||
    !home.district.country.publishedVersionId) {
    throw new AuthorizationError("District contributions require approved active citizenship and residence.");
  }
  return home.district;
}

function convertLedgerError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictError("This Vascoin event was already recorded and cannot be repeated.");
  }
  throw error;
}

/** No user input on reward amount or date: server controls both. */
export async function claimDailyVascoin(userId: string, now = new Date()) {
  if (Number.isNaN(now.getTime()) || now.getTime() > Date.now() + 60_000) {
    throw new ValidationError("Invalid claim date.");
  }
  const eventKey = `VC:DAILY:${userId}:${utcDay(now)}`;
  try {
    return await prisma.$transaction(async (tx) => {
      const policy = await tx.vascoinPolicy.findUnique({ where: { id: VASCOIN_POLICY_ID } });
      if (!policy?.dailyClaimsEnabled) throw new ConflictError("Daily Vascoin claims are not activated.");
      const already = await tx.vascoinJournal.findUnique({ where: { eventKey } });
      if (already) throw new ConflictError("Today's Vascoin has already been claimed.");
      const updated = await tx.vascoinPolicy.updateMany({
        where: { id: VASCOIN_POLICY_ID, dailyClaimsEnabled: true,
          totalIssued: { lte: VASCOIN_SUPPLY_CEILING - VASCOIN_DAILY_CLAIM } },
        data: { totalIssued: { increment: VASCOIN_DAILY_CLAIM } },
      });
      if (updated.count !== 1) throw new ConflictError("The pilot Vascoin issuance ceiling has been reached or claims are closed.");

      const wallet = await personalAccount(userId, tx);
      const issuer = await tx.vascoinAccount.upsert({
        where: { id: VASCOIN_ISSUER_ACCOUNT_ID },
        create: { id: VASCOIN_ISSUER_ACCOUNT_ID, kind: "ISSUANCE", balance: 0 },
        update: {},
      });
      if (wallet.kind !== "CITIZEN" || issuer.kind !== "ISSUANCE") {
        throw new ConflictError("Invalid Vascoin account configuration.");
      }
      const credited = await tx.vascoinAccount.updateMany({
        where: { id: wallet.id, kind: "CITIZEN", balance: { lte: intMax - VASCOIN_DAILY_CLAIM } },
        data: { balance: { increment: VASCOIN_DAILY_CLAIM } },
      });
      if (credited.count !== 1) throw new ConflictError("Wallet capacity exceeded.");
      await tx.vascoinAccount.update({ where: { id: issuer.id },
        data: { balance: { decrement: VASCOIN_DAILY_CLAIM } } });
      const entry = await tx.vascoinJournal.create({
        data: { eventKey, kind: "DAILY_CLAIM", amount: VASCOIN_DAILY_CLAIM,
          debitAccountId: issuer.id, creditAccountId: wallet.id, actorUserId: userId },
      });
      await recordAudit({ action: "vascoin.daily_claim", actorUserId: userId,
        entityType: "VascoinJournal", entityId: entry.id,
        metadata: { amount: VASCOIN_DAILY_CLAIM, unit: VASCOIN_UNIT } }, tx);
      return { journalId: entry.id, amount: VASCOIN_DAILY_CLAIM,
        balance: wallet.balance + VASCOIN_DAILY_CLAIM, unit: VASCOIN_UNIT, redeemable: false };
    });
  } catch (error) { return convertLedgerError(error); }
}

/**
 * District contributions are truly transferred in the balanced ledger.
 * They have NO spend endpoint, construction approval, fiat value, cashout or
 * promised deliverable. Distinct contribution request IDs are idempotent.
 */
export async function contributeVascoinToMyDistrict(userId: string, payload: unknown, now = new Date()) {
  const { amount, requestId } = parseOrThrow(vascoinContributionSchema, payload);
  const eventKey = `VC:DISTRICT:${userId}:${requestId}`;
  try {
    return await prisma.$transaction(async (tx) => {
      const policy = await tx.vascoinPolicy.findUnique({ where: { id: VASCOIN_POLICY_ID } });
      if (!policy?.contributionsEnabled) throw new ConflictError("District Vascoin contributions are not yet enabled.");
      const district = await approvedHome(userId, tx);
      const repeated = await tx.vascoinJournal.findUnique({ where: { eventKey } });
      if (repeated) throw new ConflictError("This contribution request has already been processed.");
      const today = await tx.vascoinJournal.aggregate({
        where: { actorUserId: userId, kind: "DISTRICT_CONTRIBUTION", createdAt: { gte: utcStart(now) } },
        _sum: { amount: true }, _count: { id: true },
      });
      if (today._count.id >= VASCOIN_MAX_CONTRIBUTIONS_PER_DAY ||
        (today._sum.amount ?? 0) + amount > VASCOIN_DAILY_CONTRIBUTION_LIMIT) {
        throw new ConflictError("Daily contribution limit reached.");
      }
      const wallet = await personalAccount(userId, tx);
      if (wallet.kind !== "CITIZEN") throw new ConflictError("Invalid citizen wallet.");
      const treasury = await tx.vascoinAccount.upsert({
        where: { districtId: district.id },
        create: { districtId: district.id, kind: "DISTRICT", balance: 0 },
        update: {},
      });
      if (treasury.kind !== "DISTRICT") throw new ConflictError("Invalid district treasury.");
      const debit = await tx.vascoinAccount.updateMany({
        where: { id: wallet.id, kind: "CITIZEN", balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (debit.count !== 1) throw new ConflictError("Insufficient Vascoin balance.");
      const credit = await tx.vascoinAccount.updateMany({
        where: { id: treasury.id, kind: "DISTRICT", balance: { lte: intMax - amount } },
        data: { balance: { increment: amount } },
      });
      if (credit.count !== 1) throw new ConflictError("District treasury limit reached.");
      const entry = await tx.vascoinJournal.create({
        data: { eventKey, kind: "DISTRICT_CONTRIBUTION", amount,
          debitAccountId: wallet.id, creditAccountId: treasury.id,
          actorUserId: userId, districtId: district.id },
      });
      await recordAudit({ action: "vascoin.district_contribution", actorUserId: userId,
        entityType: "VascoinJournal", entityId: entry.id,
        metadata: { districtId: district.id, amount, unit: VASCOIN_UNIT } }, tx);
      return { journalId: entry.id, amount, walletBalance: wallet.balance - amount,
        districtId: district.id, treasuryBalance: treasury.balance + amount,
        unit: VASCOIN_UNIT, constructionAuthorized: false, redeemable: false };
    });
  } catch (error) { return convertLedgerError(error); }
}

export async function getMyVascoinOverview(userId: string) {
  const [policy, wallet, home] = await Promise.all([
    prisma.vascoinPolicy.findUnique({ where: { id: VASCOIN_POLICY_ID } }),
    prisma.vascoinAccount.findUnique({ where: { ownerUserId: userId } }),
    prisma.foundingDistrictResidence.findUnique({ where: { userId },
      select: { districtId: true, district: { select: { name: true } } } }),
  ]);
  let eligibleDistrictId: string | null = null;
  if (home) {
    try { await approvedHome(userId, prisma); eligibleDistrictId = home.districtId; }
    catch { eligibleDistrictId = null; }
  }
  const [entries, todayClaim, treasury] = await Promise.all([
    wallet ? prisma.vascoinJournal.findMany({
      where: { OR: [{ debitAccountId: wallet.id }, { creditAccountId: wallet.id }] },
      select: { id: true, kind: true, amount: true, debitAccountId: true, creditAccountId: true, createdAt: true, districtId: true },
      orderBy: { createdAt: "desc" }, take: 25,
    }) : Promise.resolve([]),
    prisma.vascoinJournal.findUnique({
      where: { eventKey: `VC:DAILY:${userId}:${utcDay(new Date())}` },
      select: { id: true },
    }),
    eligibleDistrictId ? prisma.vascoinAccount.findUnique({
      where: { districtId: eligibleDistrictId }, select: { balance: true },
    }) : Promise.resolve(null),
  ]);
  return {
    currency: VASCOIN_UNIT,
    balance: wallet?.balance ?? 0,
    dailyReward: VASCOIN_DAILY_CLAIM,
    dailyClaimsEnabled: Boolean(policy?.dailyClaimsEnabled),
    claimedToday: Boolean(todayClaim),
    districtContributionsEnabled: Boolean(policy?.contributionsEnabled && eligibleDistrictId),
    district: eligibleDistrictId && home ? {
      id: eligibleDistrictId, name: home.district.name, treasuryBalance: treasury?.balance ?? 0,
    } : null,
    recentEntries: entries.map((e) => ({
      id: e.id, kind: e.kind, amount: e.amount,
      direction: e.creditAccountId === wallet?.id ? "IN" as const : "OUT" as const,
      districtId: e.districtId, createdAt: e.createdAt,
    })),
    notice: vascoinNotice,
    availableForConstruction: false,
    redeemable: false,
    separateFromSVCAndGFC: true,
  };
}

/** Operator reconciliation routine — read-only; does not mint or repair rows. */
export async function verifyVascoinLedger() {
  const [accounts, journal, policy] = await Promise.all([
    prisma.vascoinAccount.findMany({ select: { id: true, balance: true, kind: true } }),
    prisma.vascoinJournal.findMany({
      select: { kind: true, amount: true, debitAccountId: true, creditAccountId: true },
    }),
    prisma.vascoinPolicy.findUnique({ where: { id: VASCOIN_POLICY_ID } }),
  ]);
  const expected = new Map(accounts.map((a) => [a.id, 0]));
  let totalMinted = 0;
  for (const e of journal) {
    if (e.amount <= 0 || e.debitAccountId === e.creditAccountId) {
      return { valid: false, reason: "Invalid journal amount or same-account posting." };
    }
    if (!expected.has(e.debitAccountId) || !expected.has(e.creditAccountId)) {
      return { valid: false, reason: "Journal refers to a missing account." };
    }
    expected.set(e.debitAccountId, expected.get(e.debitAccountId)! - e.amount);
    expected.set(e.creditAccountId, expected.get(e.creditAccountId)! + e.amount);
    if (e.kind === "DAILY_CLAIM") totalMinted += e.amount;
  }
  const totalAccountBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  return {
    valid: accounts.every((a) => a.balance === expected.get(a.id)) &&
      totalAccountBalance === 0 && (policy?.totalIssued ?? 0) === totalMinted,
    totalAccountBalance, totalMinted, accountCount: accounts.length, journalCount: journal.length,
  };
}
