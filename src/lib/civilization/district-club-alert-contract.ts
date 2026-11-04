import { z } from "zod";

const utcHour = z.number().int().min(0).max(23).nullable();
export const clubAlertSettingsSchema = z.strictObject({
  chatAlerts: z.boolean(),
  eventAlerts: z.boolean(),
  quietStartHourUtc: utcHour,
  quietEndHourUtc: utcHour,
}).refine(value =>
  (value.quietStartHourUtc === null) === (value.quietEndHourUtc === null), {
  message: "Set both UTC quiet-hour boundaries or leave both blank.",
});
export const clubDeliveryCapabilities = {
  sseInvalidation: true,
  intervalPollingFallback: true,
  browserPush: false,
  email: false,
  voiceRooms: false,
} as const;
