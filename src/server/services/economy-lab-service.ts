import { z } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createTown, advanceTownDay, setTownTax, totalMoney, ECONOMY_LAB_NOTICE,
  type EconomyLabState, type LabTransfer,
} from "@/lib/economy/economy-lab";
import { prisma } from "@/server/db/client";
import { requireMembership } from "@/server/services/workspace-service";

const newLabSchema = z.strictObject({ name: z.string().trim().min(3).max(80) });
const actionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("ADVANCE"), revision: z.number().int().min(0) }),
  z.strictObject({
    kind: z.literal("SET_TAX"), revision: z.number().int().min(0),
    taxBps: z.number().int().min(0).max(2500),
  }),
]);
function decode(row: { stateJson: string }): EconomyLabState {
  const state = JSON.parse(row.stateJson) as EconomyLabState;
  if (state.version !== 1) throw new Error("Unsupported economy scenario version");
  return state;
}
function project(row: {
  id: string; name: string; revision: number; stateJson: string;
  createdAt: Date; updatedAt: Date;
}) {
  const state = decode(row);
  return {
    id: row.id, name: row.name, revision: row.revision, state,
    totalSupply: totalMoney(state), notice: ECONOMY_LAB_NOTICE,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}
export async function listEconomyLabs(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "world.view");
  const labs = await prisma.economyLab.findMany({
    where: { workspaceId, creatorId: userId },
    orderBy: { updatedAt: "desc" }, take: 10,
  });
  return labs.map(project);
}
export async function createEconomyLab(userId: string, workspaceId: string, raw: unknown) {
  await requireMembership(userId, workspaceId, "world.manage");
  const input = newLabSchema.safeParse(raw);
  if (!input.success) throw new ValidationError("Enter a town name between 3 and 80 characters.");
  const existing = await prisma.economyLab.count({ where: { workspaceId, creatorId: userId } });
  if (existing >= 3) throw new ConflictError("You can create up to three private pilot towns per workspace.");
  const { state, opening } = createTown(input.data.name);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.economyLab.create({
      data: { workspaceId, creatorId: userId, name: state.name, stateJson: JSON.stringify(state) },
    });
    await tx.economyLabTransfer.createMany({
      data: opening.map((item, index) => ({
        labId: row.id, sequence: index + 1, ...item,
      })),
    });
    return row;
  });
  return project(created);
}
async function ownedLab(userId: string, workspaceId: string, labId: string) {
  const row = await prisma.economyLab.findFirst({
    where: { id: labId, workspaceId, creatorId: userId },
  });
  if (!row) throw new NotFoundError("Private economy scenario not found.");
  return row;
}
export async function getEconomyLab(userId: string, workspaceId: string, labId: string) {
  await requireMembership(userId, workspaceId, "world.view");
  const row = await ownedLab(userId, workspaceId, labId);
  const recent = await prisma.economyLabTransfer.findMany({
    where: { labId: row.id }, orderBy: { sequence: "desc" }, take: 35,
    select: { day: true, fromAccount: true, toAccount: true, amount: true, kind: true },
  });
  return { ...project(row), recent };
}
export async function mutateEconomyLab(
  userId: string, workspaceId: string, labId: string, raw: unknown,
) {
  await requireMembership(userId, workspaceId, "world.manage");
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Invalid economy action or revision.");
  const action = parsed.data;
  const row = await ownedLab(userId, workspaceId, labId);
  if (row.revision !== action.revision) {
    throw new ConflictError("The economy changed. Refresh and retry your action.");
  }
  const current = decode(row);
  let state: EconomyLabState;
  let transfers: LabTransfer[] = [];
  try {
    if (action.kind === "ADVANCE") {
      const next = advanceTownDay(current);
      state = next.state;
      transfers = next.transfers;
    } else {
      state = setTownTax(current, action.taxBps);
    }
  } catch {
    throw new ValidationError("This simulation action cannot be applied.");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.economyLab.updateMany({
      where: { id: labId, workspaceId, creatorId: userId, revision: action.revision },
      data: { revision: { increment: 1 }, stateJson: JSON.stringify(state) },
    });
    if (changed.count !== 1) throw new ConflictError("The economy changed. Refresh and retry.");
    if (transfers.length > 0) {
      const count = await tx.economyLabTransfer.count({ where: { labId } });
      await tx.economyLabTransfer.createMany({
        data: transfers.map((item, index) => ({
          labId, sequence: count + index + 1, ...item,
        })),
      });
    }
    return tx.economyLab.findUniqueOrThrow({ where: { id: labId } });
  });
  return project(updated);
}
