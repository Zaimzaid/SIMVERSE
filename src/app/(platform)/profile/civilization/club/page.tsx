import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/context";
import { getMyDistrictClubHome } from "@/server/services/district-club-service";
import { DistrictClubClient } from "@/components/civilization/district-club-client";
import { DistrictClubDirectoryClient } from "@/components/civilization/district-club-directory-client";
import { DistrictClubEventsClient } from "@/components/civilization/district-club-events-client";
import { DistrictClubInterestClient } from "@/components/civilization/district-club-interest-client";
import { DistrictClubAlertSettingsClient } from "@/components/civilization/district-club-alert-settings-client";

export const metadata: Metadata = {
  title: "My District Club | KAVANDRO",
  robots: { index: false, follow: false },
};

export default async function DistrictClubPage() {
  const user = await requireUser();
  const home = await getMyDistrictClubHome(user.id);
  return <main className="mx-auto max-w-5xl space-y-7">
    <Link href="/profile/civilization" className="text-sm font-semibold text-accent hover:underline">
      ← My Civilization
    </Link>
    <header>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        KAVANDRO · Build Your Civilization · District Community
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
        District Club
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
        Your friendly meeting space for neighbors: chat, introductions, shared interests and activities.
        This is separate from official District Assembly decisions and development proposals.
      </p>
    </header>
    <DistrictClubClient home={home} />
    {home.active && <DistrictClubDirectoryClient />}
    {home.active && <DistrictClubEventsClient />}
    {home.active && <DistrictClubInterestClient />}
    {home.active && <DistrictClubAlertSettingsClient />}
    <p className="text-xs leading-6 text-secondary">
      <Link href="/profile/civilization/club/safety" className="font-semibold text-accent hover:underline">Safety & appeals</Link>
      {" · "}
      Social clubs are residents-only pilots and need independently activated districts.
      General friends and private messages are still available in{" "}
      <Link href="/social" className="font-semibold text-accent hover:underline">Friends & Messages</Link>.
    </p>
  </main>;
}
