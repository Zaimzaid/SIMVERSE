import type { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/server/db/client";

/** Significant platform actions recorded to the audit trail. */
export type AuditAction =
  | "user.registered"
  | "user.logged_in"
  | "user.logged_out"
  | "user.profile_updated"
  | "workspace.created"
  | "workspace.updated"
  | "entity.created"
  | "entity.updated"
  | "entity.duplicated"
  | "entity.archived"
  | "entity.restored"
  | "entity.deleted"
  | "attribute.created"
  | "attribute.updated";

type DbClient = PrismaClient | Prisma.TransactionClient;

interface AuditInput {
  action: AuditAction;
  workspaceId?: string | null;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Append an entry to the audit log. Auditing is best-effort: a failure here
 * must never break the primary action that triggered it.
 */
export async function recordAudit(
  input: AuditInput,
  client: DbClient = prisma,
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        action: input.action,
        workspaceId: input.workspaceId ?? null,
        actorUserId: input.actorUserId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    logger.error("Failed to record audit log", {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
