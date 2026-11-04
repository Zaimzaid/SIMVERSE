import { z } from "zod";
import { districtClubRoomSchema } from "./district-club-contract";

export const clubActivityChannelSchema = z.union([
  districtClubRoomSchema,
  z.literal("EVENTS"),
]);

export const clubActivityAcknowledgeSchema = z.strictObject({
  channel: clubActivityChannelSchema,
  itemId: z.string().regex(/^[a-z0-9]{20,40}$/i),
});

export const clubActivityPolicy = {
  refreshIntervalMs: 5000,
  maxUnreadPerChannel: 99,
  transport: "CONDITIONAL_POLLING",
  webSocketDelivery: false,
  browserPushEnabled: false,
} as const;
