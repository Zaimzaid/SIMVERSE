import { prisma } from "@/server/db/client";
import { ValidationError } from "@/lib/errors";
import { avatarSchema, parseStoredPlayerAvatar } from "@/lib/player-avatar/appearance";
import { ensurePlayerIdentity } from "./player-identity-service";
import { recordAudit } from "./audit-service";
/** Player-owned appearance; no special workspace permission or client-controlled roles. */
export async function getMyPlayerAvatar(userId: string) {
  const identity = await ensurePlayerIdentity(userId);
  return parseStoredPlayerAvatar(identity.avatarAppearanceJson);
}
export async function saveMyPlayerAvatar(userId: string, payload: unknown) {
  const result = avatarSchema.safeParse(payload);
  if (!result.success) throw new ValidationError("Check your character colors, height and hairstyle.");
  await ensurePlayerIdentity(userId);
  const identity = await prisma.playerIdentity.update({
    where: { userId }, data: { avatarAppearanceJson: JSON.stringify(result.data) },
  });
  await recordAudit({ action: "user.player_avatar_updated", actorUserId: userId,
    entityType: "PlayerIdentity", entityId: identity.id });
  return result.data;
}
