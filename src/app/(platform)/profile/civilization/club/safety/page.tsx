import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/context";
import { getMyClubSafety } from "@/server/services/district-club-safety-service";
import { DistrictClubSafetyClient } from "@/components/civilization/district-club-safety-client";
export const metadata: Metadata = {
  title: "District Club Safety & Appeals | KAVANDRO",
  robots: { index: false, follow: false },
};
export default async function ClubSafetyPage() {
  const user = await requireUser();
  const initial = await getMyClubSafety(user.id);
  return <main className="mx-auto max-w-4xl space-y-6">
    <Link href="/profile/civilization/club"
      className="text-sm font-semibold text-accent hover:underline">← District Club</Link>
    <h1 className="font-display text-3xl font-semibold text-foreground">Safety & appeals</h1>
    <p className="text-sm leading-7 text-secondary">
      Review your Club restrictions and request independent consideration.
      This page remains available during a Club suspension.
    </p>
    <DistrictClubSafetyClient initial={initial} />
  </main>;
}
