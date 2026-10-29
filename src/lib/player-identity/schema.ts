import { z } from "zod";

/** Identity and player-facing presentation; never a real-world document. */
export const PLAYER_PROFILE_VISIBILITY = ["PRIVATE", "PUBLIC"] as const;
export const PLAYER_EXPERIENCE_MODES = ["PLAYER", "CREATOR", "BOTH"] as const;
const RESERVED = new Set([
  "admin", "administrator", "api", "auth", "dashboard", "earth", "help",
  "login", "logout", "me", "moderator", "official", "passport", "privacy",
  "register", "root", "settings", "simverse", "staff", "support", "system", "u",
]);

export const usernameInput = z.string().trim().toLowerCase()
  .max(24, "Username must not exceed 24 characters.")
  .refine((value) => !value || /^[a-z][a-z0-9_]{2,23}$/.test(value), {
    message: "Use 3–24 characters, beginning with a letter; letters, numbers and underscores only.",
  })
  .refine((value) => !RESERVED.has(value), "This username is reserved.")
  .transform((value) => value || null);

const imageUrl = z.union([
  z.literal(""),
  z.string().regex(/^\/api\/images\/[a-z0-9]{10,40}$/, "Choose a SIMVERSE uploaded image."),
  z.url("Enter a valid image URL.").max(2048)
    .refine((value) => value.startsWith("https://"), "Use an HTTPS image URL."),
]).transform((value) => value || null);

export const playerIdentityUpdateSchema = z.strictObject({
  username: usernameInput,
  displayName: z.string().trim().min(2).max(60),
  avatarUrl: imageUrl,
  bannerUrl: imageUrl,
  creatorName: z.string().trim().max(60).transform((value) => value || null),
  biography: z.string().trim().max(500),
  profileVisibility: z.enum(PLAYER_PROFILE_VISIBILITY),
  experienceMode: z.enum(PLAYER_EXPERIENCE_MODES),
  // A sourced country is optional; it is NOT a verified citizenship.
  homeCountryId: z.union([
    z.literal(""),
    z.string().trim().min(5).max(40).regex(/^[a-z0-9]+$/),
  ]).transform((value) => value || null),
});

export type PlayerIdentityUpdate = z.infer<typeof playerIdentityUpdateSchema>;
export type PlayerProfileVisibility = typeof PLAYER_PROFILE_VISIBILITY[number];
export type PlayerExperienceMode = typeof PLAYER_EXPERIENCE_MODES[number];
