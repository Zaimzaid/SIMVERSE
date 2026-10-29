import type { SafeUser } from "@/lib/types";
import { parseOrThrow, updateProfileSchema } from "@/lib/validation";
import { prisma, SAFE_USER_OMIT } from "@/server/db/client";
import { recordAudit } from "./audit-service";

/** Update the current user's profile (display name, avatar). */
export async function updateProfile(
  userId: string,
  input: unknown,
): Promise<SafeUser> {
  const data = parseOrThrow(updateProfileSchema, input);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { displayName: data.displayName, avatarUrl: data.avatarUrl ?? null },
    omit: SAFE_USER_OMIT,
  });

  await recordAudit({
    action: "user.profile_updated",
    actorUserId: userId,
    entityType: "User",
    entityId: userId,
  });

  return updated;
}

/** Fetch a safe user by id. */
export async function getUserById(userId: string): Promise<SafeUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    omit: { passwordHash: true },
  });
}
