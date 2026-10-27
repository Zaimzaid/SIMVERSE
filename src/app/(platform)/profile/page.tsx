import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, FileBadge2, IdCard, Plane } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyPlayerIdentity, listPlayerHomeCountries } from "@/server/services/player-identity-service";
import { PlayerIdentityForm } from "@/components/player/player-identity-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "My SIMVERSE Identity" };

const profileDestinations = [
  {
    label: "My documents",
    body: "Citizenship, passports and identity applications",
    href: "/profile/documents", icon: FileBadge2,
  },
  {
    label: "Travel",
    body: "Explore fictional routes and visa eligibility",
    href: "/profile/travel", icon: Plane,
  },
  {
    label: "Career & wallet",
    body: "Professions, credits and virtual businesses",
    href: "/profile/career", icon: BriefcaseBusiness,
  },
] as const;

export default async function MyProfilePage() {
  const user = await requireUser();
  const [identity, countries] = await Promise.all([
    getMyPlayerIdentity(user.id), listPlayerHomeCountries(),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <PageHeader icon={IdCard} eyebrow="My SIMVERSE" title="Player identity"
        description="Your personal hub for profile settings, virtual-world documents, travel and careers." />
      <section aria-label="Player services" className="grid gap-3 sm:grid-cols-3">
        {profileDestinations.map((destination) => {
          const Icon = destination.icon;
          return (
            <Link key={destination.href} href={destination.href}
              className="group relative flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/45 hover:bg-surface-hover">
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-xl bg-accent-soft p-2.5 text-accent"><Icon className="size-5" aria-hidden /></span>
                <ArrowUpRight className="size-4 text-muted group-hover:text-accent" aria-hidden />
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">{destination.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-secondary">{destination.body}</p>
              </div>
            </Link>
          );
        })}
      </section>
      <section aria-labelledby="player-profile-heading" className="space-y-4">
        <div>
          <h2 id="player-profile-heading" className="text-lg font-semibold text-foreground">My profile settings</h2>
          <p className="mt-1 text-sm text-muted">Manage what other SIMVERSE users can see.</p>
        </div>
        <PlayerIdentityForm initial={identity} countries={countries} />
      </section>
    </div>
  );
}
