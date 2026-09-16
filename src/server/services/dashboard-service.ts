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
 * Real workspace metrics. Projects/simulations/exports have no tables yet, so
 * they are genuinely zero — never fabricated. Entities are counted live from the
 * Entity table (ACTIVE only) for the current workspace.
 */
export async function getWorkspaceStats(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceStats> {
  await requireMembership(userId, workspaceId, "workspace.view");
  const entities = await prisma.entity.count({
    where: { workspaceId, status: "ACTIVE" },
  });
  return { projects: 0, simulations: 0, entities, exports: 0 };
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
