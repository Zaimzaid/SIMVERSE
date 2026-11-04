import type { Metadata } from "next";
import Link from "next/link";
import { AuthorizationError } from "@/lib/errors";
import { requireUser } from "@/server/context";
import { prisma } from "@/server/db/client";
import { DistrictClubStewardClient } from "@/components/civilization/district-club-steward-client";

export const metadata: Metadata = {
  title: "District Club Steward Operations | KAVANDRO",
  robots: { index: false, follow: false },
};
export default async function ClubStewardsPage() {
  const user = await requireUser();
  const steward = await prisma.fictionalPlanetSteward.findUnique({
    where: { userId: user.id },
  });
  if (!steward?.isActive || !steward.canPublish) throw new AuthorizationError();
  return <main className="mx-auto max-w-4xl space-y-6">
    <Link href="/profile/civilization/club" className="text-sm font-semibold text-accent hover:underline">
      ← District Club
    </Link>
    <h1 className="font-display text-3xl font-semibold text-foreground">Club staff operations</h1>
    <DistrictClubStewardClient />
  </main>;
}
