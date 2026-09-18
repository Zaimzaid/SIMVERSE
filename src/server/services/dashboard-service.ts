import { requireMembership } from "@/server/services/workspace-service";
import { prisma } from "@/server/db/client";

export interface WorkspaceStats {
  projects: number;
  simulations: number;
  entities: number;
  exports: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Real workspace metrics, counted live and never fabricated. Projects counts
 * ACTIVE projects; simulations counts non-archived blueprints (DRAFT + READY);
 * entities counts ACTIVE entities. Exports has no table yet, so it is genuinely
 * zero (the execution/export engine arrives in a later phase).
 */
export async function getWorkspaceStats(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceStats> {
  await requireMembership(userId, workspaceId, "workspace.view");
  const [projects, simulations, entities] = await Promise.all([
    prisma.project.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.simulation.count({ where: { workspaceId, status: { not: "ARCHIVED" } } }),
    prisma.entity.count({ where: { workspaceId, status: "ACTIVE" } }),
  ]);
  return { projects, simulations, entities, exports: 0 };
}

/** Recent audit activity visible to the user within this workspace. */
export async function getRecentActivity(
  userId: string,
  workspaceId: string,
  limit = 8,
): Promise<ActivityItem[]> {
  await requireMembership(userId, workspaceId, "workspace.view");

  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [{ workspaceId }, { actorUserId: userId, workspaceId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    metadata: safeParse(row.metadata),
    createdAt: row.createdAt,
  }));
}

function safeParse(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
