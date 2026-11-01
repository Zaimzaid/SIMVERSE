import Link from "next/link";
import type { Metadata } from "next";
import { Flag, MapPin, ShieldCheck, Users } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyPlayerIdentity } from "@/server/services/player-identity-service";
import { getMyFoundingCitizenInterest } from "@/server/services/founding-citizen-interest-service";
import { getMyFoundingCitizenshipDraft } from "@/server/services/founding-citizenship-draft-service";
import { getMyFoundingApplicationReadiness } from "@/server/services/founding-citizenship-intake-service";
import { getMyFoundingCivicStatus, listJoinableFoundingDistricts } from "@/server/services/founding-residence-service";
import { listPublicFictionalCountries } from "@/server/services/fictional-planet-service";
import { FoundingCivicDashboard } from "@/components/player/founding-civic-dashboard";
import { FoundingApplicationReadinessPanel } from "@/components/player/founding-application-readiness-panel";
import { FoundingCitizenshipDraftForm } from "@/components/player/founding-citizenship-draft-form";
import { FoundingCitizenInterestForm } from "@/components/player/founding-citizen-interest-form";

export const metadata: Metadata = { title: "My Civilization | SIMVERSE" };

export default async function MyCivilizationPage() {
  const user = await requireUser();
  const [identity, interest, applicationDraft, applicationReadiness, civic, eligibleDistricts, countries] = await Promise.all([
    getMyPlayerIdentity(user.id),
    getMyFoundingCitizenInterest(user.id),
    getMyFoundingCitizenshipDraft(user.id),
    getMyFoundingApplicationReadiness(user.id),
    getMyFoundingCivicStatus(user.id),
    listJoinableFoundingDistricts(user.id),
    listPublicFictionalCountries(),
  ]);
  return (
    <main className="mx-auto max-w-5xl space-y-7">
      <div>
        <Link href="/profile" className="text-sm font-semibold text-accent hover:underline">
          ← Back to my profile
        </Link>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          SIMVERSE · Build Your Civilization · Phase 3
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          My future civilization
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
          Choose which founding country you are most interested in, and optionally
          express interest in the proposed pilot district. These are personal planning
          choices while the fictional geography and official citizenship processes are developed.
        </p>
      </div>

      <section aria-label="Current identity and residence status" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Flag className="size-5 text-accent" aria-hidden />
          <p className="mt-3 text-sm text-secondary">Preferred founding nation</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {interest.preferredNationName ?? "Not selected"}
          </p>
          <p className="mt-1 text-sm text-secondary">Personal preference only</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Users className="size-5 text-accent" aria-hidden />
          <p className="mt-3 text-sm text-secondary">Proposed pilot interest</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {interest.proposedPilotInterest ? "Interested" : "Not registered"}
          </p>
          <p className="mt-1 text-sm text-secondary">No active district assigned</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <MapPin className="size-5 text-accent" aria-hidden />
          <p className="mt-3 text-sm text-secondary">Current residence</p>
          <p className="mt-1 text-lg font-semibold text-foreground">Unassigned</p>
          <p className="mt-1 text-sm text-secondary">Residence starts after geography approval</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Set your founding-world preferences
        </h2>
        <p className="mb-6 mt-2 text-sm text-secondary">
          This form does not change your existing Earth-based home-country choice
          or your previously reviewed virtual citizenship documents.
        </p>
        <FoundingCitizenInterestForm initial={interest} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">Prepare a citizenship application</h2>
          <span className="rounded-full border border-border px-3 py-1 text-sm font-semibold text-secondary">Phase 3B · Draft only</span>
        </div>
        <FoundingCitizenshipDraftForm initial={applicationDraft} suggestedCountry={interest.preferredNationSlug} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7" aria-labelledby="citizenship-readiness">
        <h2 id="citizenship-readiness" className="font-display text-xl font-semibold text-foreground">
          Citizenship application readiness
        </h2>
        <p className="mt-2 mb-5 text-sm text-secondary">
          Review the exact requirements before any application can be submitted.
          Countries without published geography or independently opened intake remain closed.
        </p>
        <FoundingApplicationReadinessPanel initial={applicationReadiness} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-foreground">Nationality, residency and travel</h2>
        <p className="mt-2 mb-4 text-sm text-secondary">
          Independent verified records determine your citizenship and home district.
          A temporary visit never changes voting eligibility.
        </p>
        <FoundingCivicDashboard initial={civic}
          districts={eligibleDistricts.districts}
          publicCountries={countries.countries.map(({id, name}) => ({id, name}))}/>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <ShieldCheck className="size-5 text-accent" aria-hidden />
          Identity, citizenship and residence are separate
        </h2>
        <p className="mt-3 text-sm leading-7 text-secondary">
          Your existing SIMVERSE identity remains permanent. Official fictional
          citizenship requires its own reviewed process, while residence requires
          an active, approved district. A preferred nationality or pilot interest
          is neither of those things. Your current profile visibility is 
          {identity.profileVisibility === "PUBLIC" ? "public" : "restricted to you and accepted friends"};
          private citizenship records are not displayed on your public profile.
        </p>
        <p className="mt-3 text-sm text-secondary">
          Identity: {identity.username ? `@${identity.username}` : "Username not yet chosen"}.
          Existing citizenship documents: {identity.citizenships.length} historical ledger entries
          (not changed by this feature).
        </p>
        <Link href="/profile/documents" className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline">
          Review existing virtual citizenship documents →
        </Link>
      </section>
    </main>
  );
}
