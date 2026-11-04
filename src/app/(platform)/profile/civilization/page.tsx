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

export const metadata: Metadata = { title: "My Civilization | KAVANDRO" };

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
          KAVANDRO · Build Your Civilization · Preview
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
          <p className="mt-1 text-lg font-semibold text-foreground">{civic.residence?.districtName ?? "Unassigned"}</p>
          <p className="mt-1 text-sm text-secondary">{civic.residence ? "Active approved district residence" : "Residence starts after geography approval"}</p>
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
          <span className="rounded-full border border-border px-3 py-1 text-sm font-semibold text-secondary">Draft editor ready · Intake approval required</span>
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
        <h2 className="font-display text-xl font-semibold text-foreground">Citizen-led development</h2>
        <p className="mt-2 text-sm leading-7 text-secondary">
          Follow assembly-shortlisted ideas through independent staff feasibility
          review and planning updates. No real sites or virtual funds are committed.
        </p>
        <Link href="/profile/civilization/development"
          className="mt-4 inline-block rounded-xl border border-border px-5 py-3 text-sm font-semibold text-accent">
          View district development
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-foreground">District land & zoning</h2>
        <p className="mt-2 text-sm leading-7 text-secondary">
          Explore a clearly labeled schematic of protected corridors, public reserves
          and possible development areas. Only independently granted planners can edit drafts;
          no official land parcels are active.
        </p>
        <Link href="/profile/civilization/land"
          className="mt-4 inline-block rounded-xl border border-border px-5 py-3 text-sm font-semibold text-accent">
          Open land planning preview
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-foreground">Daily Citizen Challenge</h2>
        <p className="mt-2 text-sm leading-7 text-secondary">
          Play an independent non-3D strategy puzzle, make fictional community choices and
          compare anonymous scores. No live district development or Vascoin is awarded.
        </p>
        <Link href="/profile/civilization/challenge"
          className="mt-4 inline-block rounded-xl border border-border px-5 py-3 text-sm font-semibold text-accent">
          Play today's challenge
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-foreground">My Vascoin Wallet</h2>
        <p className="mt-2 text-sm leading-7 text-secondary">
          Track virtual daily rewards, your own nonredeemable VC balance, and
          future contributions to an independently approved district treasury.
        </p>
        <Link href="/profile/civilization/vascoin"
          className="mt-4 inline-block rounded-xl border border-border px-5 py-3 text-sm font-semibold text-accent">
          Open Vascoin Wallet
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-foreground">My District Club</h2>
        <p className="mt-2 text-sm leading-7 text-secondary">
          Meet approved residents and chat in friendly rooms. The Club is for social life rather than
          official district decisions. It opens only after genuine district residence activation.
        </p>
        <Link href="/profile/civilization/club"
          className="mt-4 inline-block rounded-xl border border-border px-5 py-3 text-sm font-semibold text-accent">
          Open my district club
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-foreground">My District Assembly</h2>
        <p className="mt-2 text-sm leading-7 text-secondary">
          Discuss what your community should build, submit a moderated project
          idea, see announcements and vote when your district becomes eligible.
          Unapproved districts remain inactive.
        </p>
        <Link href="/profile/civilization/assembly"
          className="mt-4 inline-block rounded-xl border border-border px-5 py-3 text-sm font-semibold text-accent">
          Open my district assembly
        </Link>
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
          Your existing KAVANDRO identity remains permanent. Official fictional
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
