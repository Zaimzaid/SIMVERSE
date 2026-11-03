import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import {
  clubAlertSettingsSchema, clubDeliveryCapabilities,
} from "@/lib/civilization/district-club-alert-contract";
import { approvedHome } from "./district-club-service";

export async function getMyClubAlertSettings(userId: string) {
  const district = await approvedHome(userId);
  const saved = await prisma.districtClubNotificationPreference.findUnique({ where: { userId } });
  const inDistrict = saved?.districtId === district.id;
  return {
    district: { id: district.id, name: district.name },
    chatAlerts: inDistrict ? saved.chatAlerts : true,
    eventAlerts: inDistrict ? saved.eventAlerts : true,
    quietStartHourUtc: inDistrict ? saved.quietStartHourUtc : null,
    quietEndHourUtc: inDistrict ? saved.quietEndHourUtc : null,
    capabilities: clubDeliveryCapabilities,
  };
}

export async function saveMyClubAlertSettings(userId: string, raw: unknown) {
  const input = parseOrThrow(clubAlertSettingsSchema, raw);
  const district = await approvedHome(userId);
  const saved = await prisma.districtClubNotificationPreference.upsert({
    where: { userId },
    create: { userId, districtId: district.id, ...input },
    update: { districtId: district.id, ...input },
  });
  return { saved: true, chatAlerts: saved.chatAlerts,
    eventAlerts: saved.eventAlerts,
    quietStartHourUtc: saved.quietStartHourUtc,
    quietEndHourUtc: saved.quietEndHourUtc };
}

export function isQuietHour(now: Date, start: number | null, end: number | null) {
  if (start === null || end === null || start === end) return false;
  const h = now.getUTCHours();
  return start < end ? h >= start && h < end : h >= start || h < end;
}

export async function clubLiveActivityMarker(userId: string) {
  const district = await approvedHome(userId);
  const [lastMessage, lastEvent, lastSanction, lastReport] = await Promise.all([
    prisma.districtClubMessage.findFirst({
      where: { districtId: district.id, status: "VISIBLE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    }),
    prisma.districtClubEvent.findFirst({
      where: { districtId: district.id, status: "PUBLISHED" },
      orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
      select: { id: true, reviewedAt: true },
    }),
    prisma.districtClubSanction.findFirst({
      where: { districtId: district.id, targetUserId: userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, status: true, revokedAt: true },
    }),
    prisma.districtClubReport.findFirst({
      where: { message: { districtId: district.id }, status: "OPEN" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    }),
  ]);
  // Only opaque invalidation markers go to SSE. No message content, usernames,
  // private IDs or activities are ever serialized to the browser stream.
  return [
    lastMessage?.id ?? "", lastEvent?.id ?? "", lastEvent?.reviewedAt?.getTime() ?? "",
    lastSanction?.id ?? "", lastSanction?.status ?? "", lastSanction?.revokedAt?.getTime() ?? "",
    lastReport?.id ?? "",
  ].join("|");
}
