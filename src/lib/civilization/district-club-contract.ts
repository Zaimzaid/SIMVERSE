import { z } from "zod";

export const DISTRICT_CLUB_ROOMS = [
  { key: "GENERAL", title: "General Chat", description: "Meet neighbors and talk about daily life." },
  { key: "INTRODUCTIONS", title: "Introductions", description: "Welcome new residents and make friends." },
  { key: "ACTIVITIES", title: "Activities & Games", description: "Plan friendly events, contests and recreational activities." },
  { key: "INTERESTS", title: "Shared Interests", description: "Discuss hobbies, learning and local interests." },
] as const;

export const districtClubRoomSchema = z.enum(["GENERAL", "INTRODUCTIONS", "ACTIVITIES", "INTERESTS"]);
const mediaUrlSchema = z.string().url().max(2048).refine(value => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password &&
      !/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(u.hostname) &&
      /\.(png|jpg|jpeg|gif|webp|mp4|webm)$/i.test(u.pathname);
  } catch { return false; }
}, "Use a public HTTPS media URL ending with png, jpg, gif, webp, mp4 or webm.");

export const districtClubMessageSchema = z.strictObject({
  room: districtClubRoomSchema,
  body: z.string().trim().max(650).default(""),
  mediaUrl: mediaUrlSchema.optional(),
}).refine(value => value.body.length >= 2 || Boolean(value.mediaUrl), {
  message: "Write at least two characters or attach a valid HTTPS media link.",
});
export const districtClubReportSchema = z.strictObject({
  messageId: z.string().regex(/^[a-z0-9]{20,40}$/i),
  reason: z.string().trim().min(8).max(350),
});
export const districtClubReviewSchema = z.strictObject({
  reportId: z.string().regex(/^[a-z0-9]{20,40}$/i),
  action: z.enum(["DISMISS", "HIDE"]),
});

export const districtClubRules = {
  messagesPerHour: 35,
  minimumSecondsBetweenMessages: 4,
  reportsPerHour: 5,
  maximumMessageLength: 650,
  membership: "APPROVED_RESIDENCE_AND_PRIMARY_CITIZENSHIP",
  districtConstructionAuthority: false,
  vascoinRewardsEnabled: false,
} as const;


// Directory is PRIVATE and OFF by default; changing home districts requires
// a fresh affirmative opt-in to appear in the new district's directory.
export const districtClubDirectoryPreferenceSchema = z.strictObject({
  visible: z.boolean(),
  intro: z.string().trim().max(180).default(""),
});
