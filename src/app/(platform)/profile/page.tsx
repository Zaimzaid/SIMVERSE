import type { Metadata } from "next";
import Link from "next/link";
import { IdCard } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyPlayerIdentity, listPlayerHomeCountries } from "@/server/services/player-identity-service";
import { PlayerIdentityForm } from "@/components/player/player-identity-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "My SIMVERSE Identity" };

export default async function MyProfilePage() {
  const user = await requireUser();
  const [identity, countries] = await Promise.all([
    getMyPlayerIdentity(user.id),
    listPlayerHomeCountries(),
  ]);
  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader icon={IdCard} title="My Player Identity"
      description="Manage your SIMVERSE-only character identity, privacy, creator presence and home-country preference." />
    <Link href="/profile/documents"
      className="block rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm font-semibold text-accent hover:underline">
      Open SIMVERSE Citizenship, Passports &amp; Virtual Documents →
    </Link>
    <Link href="/profile/career"
      className="block rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm font-semibold text-accent hover:underline">
      Open My Career, SIMVERSE Credits &amp; Virtual Business Drafts →
    </Link>
    <PlayerIdentityForm initial={identity} countries={countries} />
  </div>;
}
