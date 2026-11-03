import { z } from "zod";

export const CLUB_EVENT_CATEGORIES = [
  { value: "SOCIAL", title: "Social meetup" },
  { value: "GAMES", title: "Games & competitions" },
  { value: "LEARNING", title: "Learning together" },
  { value: "COMMUNITY", title: "Community gathering" },
] as const;

// Only online gatherings for this non-3D phase: no assumed physical venues.
export const clubEventDraftSchema = z.strictObject({
  title: z.string().trim().min(8).max(100),
  description: z.string().trim().min(20).max(1000),
  category: z.enum(["SOCIAL", "GAMES", "LEARNING", "COMMUNITY"]),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
});
const idSchema = z.string().regex(/^[a-z0-9]{20,40}$/i);
export const clubEventReviewSchema = z.strictObject({
  eventId: idSchema,
  action: z.enum(["PUBLISH", "REJECT", "CANCEL"]),
  reason: z.string().trim().max(300).default(""),
});
export const clubEventRsvpSchema = z.strictObject({
  eventId: idSchema,
  rsvpAction: z.enum(["JOIN", "LEAVE"]),
});
export const clubEventPolicy = {
  maximumProposalsPerWeek: 3,
  earliestStartMinutes: 30,
  latestStartDays: 90,
  maximumDurationHours: 6,
  onlineOnly: true,
  attendanceDoesNotEarnVascoin: true,
  attendanceDoesNotAuthorizeDevelopment: true,
} as const;
