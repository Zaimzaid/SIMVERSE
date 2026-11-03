import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/context";
import { listMyClubModerationQueue } from "@/server/services/district-club-service";
import { listMyClubEventReviewQueue } from "@/server/services/district-club-event-service";
import { DistrictClubModerationClient } from "@/components/civilization/district-club-moderation-client";
import { DistrictClubEventModerationClient } from "@/components/civilization/district-club-event-moderation-client";
import { getMyClubSafetyQueue } from "@/server/services/district-club-safety-service";
import { getMyDistrictClubOperations } from "@/server/services/district-club-operations-service";
import { DistrictClubOperationsClient } from "@/components/civilization/district-club-operations-client";
import { listMyClubInterestModeration } from "@/server/services/district-club-interest-service";
import { DistrictClubInterestModerationClient } from "@/components/civilization/district-club-interest-moderation-client";
import { DistrictClubSafetyModerationClient } from "@/components/civilization/district-club-safety-moderation-client";

export const metadata: Metadata = {
  title: "District Club Moderation | KAVANDRO",
  robots: { index: false, follow: false },
};

export default async function DistrictClubModerationPage() {
  const user = await requireUser();
  const [queue, eventQueue, safetyQueue, interestQueue, operations] = await Promise.all([
    listMyClubModerationQueue(user.id), listMyClubEventReviewQueue(user.id),
    getMyClubSafetyQueue(user.id), listMyClubInterestModeration(user.id),
    getMyDistrictClubOperations(user.id),
  ]);
  return <main className="mx-auto max-w-4xl space-y-6">
    <Link href="/profile/civilization/club" className="text-sm font-semibold text-accent hover:underline">
      ← District Club
    </Link>
    <h1 className="font-display text-3xl font-semibold text-foreground">Club moderation</h1>
    <DistrictClubOperationsClient data={operations} />
    <DistrictClubModerationClient initial={queue} />
    <DistrictClubEventModerationClient initial={eventQueue} />
    <DistrictClubSafetyModerationClient initial={safetyQueue} />
    <DistrictClubInterestModerationClient initial={interestQueue} />
  </main>;
}
