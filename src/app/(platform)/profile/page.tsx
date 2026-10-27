import type { Metadata } from "next";
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
    <PlayerIdentityForm initial={identity} countries={countries} />
  </div>;
}
