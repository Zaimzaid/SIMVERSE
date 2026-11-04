import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/context";
import { getMyDailyCivilizationChallenge } from "@/server/services/civilization-challenge-service";
import { DailyChallengeClient } from "@/components/civilization/daily-challenge-client";

export const metadata: Metadata = {
  title: "Daily Citizen Challenge | KAVANDRO",
  robots: { index: false, follow: false },
};

export default async function DailyCitizenChallengePage() {
  const user = await requireUser();
  const initial = await getMyDailyCivilizationChallenge(user.id);
  return (
    <main className="mx-auto max-w-5xl space-y-7">
      <Link href="/profile/civilization"
        className="inline-block text-sm font-semibold text-accent hover:underline">
        ← My Civilization
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          KAVANDRO · Phase 5 · Play without 3D
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Daily Citizen Challenge
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
          Play a short strategy puzzle about balancing fictional community improvements.
          This recreation activity is open to signed-in users while the real districts are still being reviewed.
        </p>
      </header>
      <DailyChallengeClient initial={initial} />
    </main>
  );
}
