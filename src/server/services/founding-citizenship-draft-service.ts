import { prisma } from "@/server/db/client";
import { parseOrThrow } from "@/lib/validation";
import { foundingApplicationDraftSchema, describeFoundingApplicationDraft } from "@/lib/civilization/application-draft-contract";
import { recordAudit } from "./audit-service";

export async function getMyFoundingCitizenshipDraft(userId: string) {
  const draft = await prisma.foundingCitizenshipDraft.findUnique({ where: { userId } });
  return draft ? describeFoundingApplicationDraft(draft.targetNationSlug, draft.motivation, draft.updatedAt) : null;
}

/**
 * The sole write action is saving a DRAFT. No official application is submitted
 * or reviewed and no citizenship/identity/document/residence record is touched.
 */
export async function saveMyFoundingCitizenshipDraft(userId: string, payload: unknown) {
  const data = parseOrThrow(foundingApplicationDraftSchema, payload);
  const result = await prisma.foundingCitizenshipDraft.upsert({
    where: { userId },
    create: { userId, targetNationSlug: data.targetNationSlug, motivation: data.motivation },
    update: { targetNationSlug: data.targetNationSlug, motivation: data.motivation },
  });
  await recordAudit({
    action: "user.founding_citizenship_draft_saved",
    actorUserId: userId,
    entityType: "FoundingCitizenshipDraft",
    entityId: userId,
    metadata: { nationSlug: data.targetNationSlug, statementLength: data.motivation.length, status: "DRAFT_ONLY" },
  });
  return describeFoundingApplicationDraft(result.targetNationSlug, result.motivation, result.updatedAt);
}

export async function deleteMyFoundingCitizenshipDraft(userId: string) {
  await prisma.foundingCitizenshipDraft.deleteMany({ where: { userId } });
  await recordAudit({
    action: "user.founding_citizenship_draft_deleted",
    actorUserId: userId,
    entityType: "FoundingCitizenshipDraft",
    entityId: userId,
  });
  return { deleted: true, citizenshipGranted: false } as const;
}
