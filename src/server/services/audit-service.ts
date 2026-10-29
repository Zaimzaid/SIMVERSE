import type { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/server/db/client";

/** Significant platform actions recorded to the audit trail. */
export type AuditAction =
  | "user.registered"
  | "user.logged_in"
  | "user.logged_out"
  | "user.profile_updated"
  | "user.player_identity_updated"
  | "player.document.applied"
  | "player.document.reviewed"
  | "player.travel.visa_applied"
  | "player.travel.visa_reviewed"
  | "player.governance.policy_proposed"
  | "player.governance.policy_activated"
  | "player.governance.treaty_proposed"
  | "player.governance.treaty_approved"
  | "player.economy.profession_selected"
  | "player.economy.business_draft_created"
  | "player.work.orientation_completed"
  | "player.work.business_submitted"
  | "player.work.business_reviewed"
  | "player.work.job_posted"
  | "player.work.job_applied"
  | "player.work.employer_decision"
  | "player.work.offer_answered"
  | "workspace.created"
  | "workspace.updated"
  | "workspace.invitation_created"
  | "workspace.invitation_revoked"
  | "workspace.invitation_accepted"
  | "workspace.member_role_changed"
  | "workspace.member_removed"
  | "workspace.created_additional"
  | "account.password_changed"
  | "account.sessions_revoked"
  | "account.settings_updated"
  | "entity.created"
  | "entity.updated"
  | "entity.visual_profile_updated"
  | "entity.visual_profile_deleted"
  | "entity.duplicated"
  | "entity.archived"
  | "entity.restored"
  | "entity.deleted"
  | "attribute.created"
  | "attribute.updated"
  | "project.created"
  | "project.updated"
  | "project.archived"
  | "project.restored"
  | "project.deleted"
  | "project.entity_added"
  | "project.entity_removed"
  | "simulation.created"
  | "simulation.updated"
  | "simulation.duplicated"
  | "simulation.archived"
  | "simulation.restored"
  | "simulation.deleted"
  | "simulation.ready"
  | "simulation.draft"
  | "simulation_run.created"
  | "simulation_run.started"
  | "simulation_run.paused"
  | "simulation_run.resumed"
  | "simulation_run.completed"
  | "simulation_run.failed"
  | "simulation_run.cancelled"
  | "asset.created"
  | "asset.updated"
  | "asset.archived"
  | "asset.restored"
  | "asset.deleted"
  | "world.created"
  | "world.updated"
  | "world.archived"
  | "world.restored"
  | "world.deleted"
  | "experience.created"
  | "experience.updated"
  | "experience.archived"
  | "experience.restored"
  | "experience.deleted"
  | "tournament.created"
  | "tournament.updated"
  | "tournament.participants_updated"
  | "tournament.structure_generated"
  | "tournament.ready"
  | "tournament.started"
  | "tournament.paused"
  | "tournament.resumed"
  | "tournament.cancelled"
  | "tournament.match_run_created"
  | "tournament.result_accepted"
  | "tournament.participant_advanced"
  | "tournament.completed"
  | "tournament.archived"
  | "tournament.restored"
  | "tournament.deleted"
  | "media.artifact.created"
  | "media.artifact.version_created"
  | "media.artifact.archived"
  | "media.artifact.restored"
  | "media.share.created"
  | "media.share.updated"
  | "media.share.revoked"
  | "earth.zone.created"
  | "earth.zone.version_created"
  | "earth.zone.submitted"
  | "earth.zone.activated"
  | "earth.zone.retired"
  | "earth.zone.rolled_back";

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
