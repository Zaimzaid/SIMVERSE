import { avatarSchema } from "@/lib/animation/editor";
import type { z } from "zod";
export type PlayerAvatarAppearance = z.infer<typeof avatarSchema>;
export const DEFAULT_PLAYER_AVATAR: PlayerAvatarAppearance = {
  skin: "#bc845f", outfit: "#38bfc0", hair: "#1b2835", height: 1, hairstyle: "SHORT",
};
export function parseStoredPlayerAvatar(raw: string | null): PlayerAvatarAppearance {
  if (!raw) return { ...DEFAULT_PLAYER_AVATAR };
  try { const result = avatarSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : { ...DEFAULT_PLAYER_AVATAR };
  } catch { return { ...DEFAULT_PLAYER_AVATAR }; }
}
export { avatarSchema };
