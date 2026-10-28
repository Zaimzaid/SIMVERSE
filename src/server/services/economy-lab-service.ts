import { z } from "zod";
import { ConflictError, NotFoundError, AuthorizationError, ValidationError } from "@/lib/errors";
import {
  createTown, advanceTownDay, setTownTax, totalMoney, ECONOMY_LAB_NOTICE,
  playTownAction, playerAccount,
  type EconomyLabState, type LabTransfer, type PlayerTownAction,
} from "@/lib/economy/economy-lab";
import { prisma } from "@/server/db/client";
import { requireMembership } from "@/server/services/workspace-service";

const newLabSchema = z.strictObject({ name: z.string().trim().min(3).max(80) });
const common = { revision: z.number().int().min(0) };
const actionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("ADVANCE"), ...common }),
  z.strictObject({ kind: z.literal("SET_TAX"), ...common, taxBps: z.number().int().min(0).max(2500) }),
  z.strictObject({ kind: z.literal("SET_ACCESS"), ...common, access: z.enum(["PRIVATE", "WORKSPACE"]) }),
  z.strictObject({ kind: z.literal("JOIN"), ...common }),
  z.strictObject({ kind: z.literal("OPEN_SHOP"), ...common, businessId: z.string().cuid() }),
  z.strictObject({ kind: z.literal("BUY_STOCK"), ...common, businessId: z.string().cuid(), units: z.number().int().min(1).max(8) }),
  z.strictObject({ kind: z.literal("INVEST"), ...common, businessId: z.string().cuid(), amount: z.number().int().min(1).max(1000) }),
  z.strictObject({ kind: z.literal("TAKE_PROFIT"), ...common, businessId: z.string().cuid(), amount: z.number().int().min(1).max(1000) }),
  z.strictObject({ kind: z.literal("WORK_SHIFT"), ...common, employmentId: z.string().cuid() }),
]);
function decode(row: { stateJson: string }): EconomyLabState {
  const state = JSON.parse(row.stateJson) as EconomyLabState;
  if (state.version !== 1) throw new Error("Unsupported economy scenario version");
  return state;
}
function project(row: {
  id: string; name: string; creatorId: string; access: string; revision: number; stateJson: string;
  createdAt: Date; updatedAt: Date;
}, userId: string) {
  const state = decode(row);
  return {
    id: row.id, name: row.name, revision: row.revision,
    state, owner: row.creatorId === userId, access: row.access,
    joined: Boolean(state.participants?.some(p => p.userId === userId)),
    myAccount: state.balances[playerAccount(userId)] ?? null,
    totalSupply: totalMoney(state), notice: ECONOMY_LAB_NOTICE,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}
export async function listEconomyLabs(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "world.view");
  const labs = await prisma.economyLab.findMany({
    where: { workspaceId, OR: [{ creatorId: userId }, { access: "WORKSPACE" }] },
    orderBy: { updatedAt: "desc" }, take: 15,
  });
  return labs.map(row => project(row, userId));
}
export async function createEconomyLab(userId: string, workspaceId: string, raw: unknown) {
  await requireMembership(userId, workspaceId, "world.manage");
  const input = newLabSchema.safeParse(raw);
  if (!input.success) throw new ValidationError("Enter a town name between 3 and 80 characters.");
  const existing = await prisma.economyLab.count({ where: { workspaceId, creatorId: userId } });
  if (existing >= 3) throw new ConflictError("You can create up to three private pilot towns per workspace.");
  const { state, opening } = createTown(input.data.name);
  const created = await prisma.$transaction(async tx => {
    const row = await tx.economyLab.create({
      data: { workspaceId, creatorId: userId, name: state.name, stateJson: JSON.stringify(state) },
    });
    await tx.economyLabTransfer.createMany({
      data: opening.map((item, index) => ({
        labId: row.id, sequence: index + 1,
        day: item.day, fromAccount: item.from, toAccount: item.to, amount: item.amount, kind: item.kind,
      })),
    });
    return row;
  });
  return project(created, userId);
}
async function visibleLab(userId: string, workspaceId: string, labId: string) {
  const row = await prisma.economyLab.findFirst({
    where: { id: labId, workspaceId, OR: [{ creatorId: userId }, { access: "WORKSPACE" }] },
  });
  if (!row) throw new NotFoundError("Economy scenario not found or not shared with your workspace.");
  return row;
}
export async function getEconomyLab(userId: string, workspaceId: string, labId: string) {
  await requireMembership(userId, workspaceId, "world.view");
  const row = await visibleLab(userId, workspaceId, labId);
  const [recent, businesses, employments] = await Promise.all([
    prisma.economyLabTransfer.findMany({
      where: { labId: row.id }, orderBy: { sequence: "desc" }, take: 40,
      select: { day: true, fromAccount: true, toAccount: true, amount: true, kind: true },
    }),
    prisma.playerVirtualBusiness.findMany({
      where: { identity: { userId }, status: "APPROVED" },
      select: { id: true, name: true, sector: true }, take: 20, orderBy: { createdAt: "asc" },
    }),
    prisma.playerVirtualEmployment.findMany({
      where: { status: "ACTIVE", application: { applicant: { userId } } },
      select: { id: true, application: { select: { job: { select: {
        title: true, businessId: true, business: { select: { name: true } },
      } } } } }, take: 50,
    }),
  ]);
  return {
    ...project(row, userId), recent, approvedBusinesses: businesses,
    activeEmployments: employments.map(e => ({
      id: e.id, businessId: e.application.job.businessId,
      title: e.application.job.title, businessName: e.application.job.business.name,
    })),
  };
}
async function myProfession(userId: string): Promise<string> {
  const profile = await prisma.playerCareerProfile.findFirst({
    where: { identity: { userId } }, select: { professionCode: true },
  });
  if (!profile) throw new ValidationError("Choose your SIMVERSE profession in My Career before joining a town.");
  return profile.professionCode;
}
async function approvedBusiness(userId: string, businessId: string) {
  const business = await prisma.playerVirtualBusiness.findFirst({
    where: { id: businessId, status: "APPROVED", identity: { userId } },
    select: { id: true, name: true },
  });
  if (!business) throw new AuthorizationError("You need an independently approved virtual business to operate here.");
  return business;
}
export async function mutateEconomyLab(
  userId: string, workspaceId: string, labId: string, raw: unknown,
) {
  await requireMembership(userId, workspaceId, "world.view");
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Invalid economy action, amount or revision.");
  const action = parsed.data;
  const row = await visibleLab(userId, workspaceId, labId);
  const owner = row.creatorId === userId;
  if (["ADVANCE", "SET_TAX", "SET_ACCESS"].includes(action.kind)) {
    if (!owner) throw new AuthorizationError("Only the town creator controls its simulation and policy.");
    await requireMembership(userId, workspaceId, "world.manage");
  }
  if (row.revision !== action.revision) {
    throw new ConflictError("Town was updated. Refresh and retry.");
  }
  const current = decode(row);
  let state: EconomyLabState = current;
  let transfers: LabTransfer[] = [];
  let access = row.access;
  let play: PlayerTownAction | null = null;

  if (action.kind === "JOIN") {
    play = { kind: "JOIN", userId, profession: await myProfession(userId) };
  } else if (action.kind === "OPEN_SHOP") {
    const business = await approvedBusiness(userId, action.businessId);
    play = { kind: "OPEN_SHOP", userId, businessId: business.id, businessName: business.name };
  } else if (action.kind === "BUY_STOCK" || action.kind === "INVEST" ||
             action.kind === "TAKE_PROFIT") {
    await approvedBusiness(userId, action.businessId);
    play = { ...action, userId };
  } else if (action.kind === "WORK_SHIFT") {
    const employment = await prisma.playerVirtualEmployment.findFirst({
      where: { id: action.employmentId, status: "ACTIVE", application: {
        applicant: { userId }, job: { business: { status: "APPROVED" } },
      } },
      select: { id: true, application: { select: { job: { select: { businessId: true } } } } },
    });
    if (!employment) throw new AuthorizationError("An accepted active virtual job is required.");
    play = { kind: "WORK_SHIFT", userId, employmentId: employment.id,
      businessId: employment.application.job.businessId };
  }
  if (play) {
    try {
      const result = playTownAction(current, play);
      state = result.state; transfers = result.transfers;
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "Player action unavailable");
    }
  } else if (action.kind === "ADVANCE") {
    try {
      const result = advanceTownDay(current);
      state = result.state; transfers = result.transfers;
    } catch { throw new ValidationError("Cannot advance this town."); }
  } else if (action.kind === "SET_TAX") {
    try { state = setTownTax(current, action.taxBps); }
    catch { throw new ValidationError("Tax rate not supported."); }
  } else if (action.kind === "SET_ACCESS") {
    access = action.access;
  }

  const updated = await prisma.$transaction(async tx => {
    const changed = await tx.economyLab.updateMany({
      where: { id: labId, workspaceId, revision: action.revision,
        OR: [{ creatorId: userId }, { access: "WORKSPACE" }] },
      data: { revision: { increment: 1 }, stateJson: JSON.stringify(state), access },
    });
    if (changed.count !== 1) throw new ConflictError("Town changed. Refresh and retry.");
    if (transfers.length > 0) {
      const count = await tx.economyLabTransfer.count({ where: { labId } });
      await tx.economyLabTransfer.createMany({
        data: transfers.map((item, index) => ({
          labId, sequence: count + index + 1, day: item.day,
          fromAccount: item.from, toAccount: item.to, amount: item.amount, kind: item.kind,
        })),
      });
    }
    return tx.economyLab.findUniqueOrThrow({ where: { id: labId } });
  });
  return project(updated, userId);
}
