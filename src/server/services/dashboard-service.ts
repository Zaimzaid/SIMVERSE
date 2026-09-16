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
 * Real workspace metrics. Phase 0 has no project/simulation/entity/export
 * tables yet, so these are genuinely zero — never fabricated. When those models
 * land, replace the constants with prisma counts scoped to the workspace.
 */
export async function getWorkspaceStats(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceStats> {
  await requireMembership(userId, workspaceId, "workspace.view");
  return { projects: 0, simulations: 0, entities: 0, exports: 0 };
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
