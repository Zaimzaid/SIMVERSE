import Link from "next/link";
import type { Metadata } from "next";
import { Flag, MapPin, ShieldCheck, Users } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyPlayerIdentity } from "@/server/services/player-identity-service";
import { getMyFoundingCitizenInterest } from "@/server/services/founding-citizen-interest-service";
import { FoundingCitizenInterestForm } from "@/components/player/founding-citizen-interest-form";

export const metadata: Metadata = { title: "My Civilization | SIMVERSE" };

export default async function MyCivilizationPage() {
  const user = await requireUser();
  const [identity, interest] = await Promise.all([
    getMyPlayerIdentity(user.id),
    getMyFoundingCitizenInterest(user.id),
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
          <p className="mt-3 text-xs text-secondary">Preferred founding nation</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {interest.preferredNationName ?? "Not selected"}
          </p>
          <p className="mt-1 text-xs text-secondary">Personal preference only</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Users className="size-5 text-accent" aria-hidden />
          <p className="mt-3 text-xs text-secondary">Proposed pilot interest</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {interest.proposedPilotInterest ? "Interested" : "Not registered"}
          </p>
          <p className="mt-1 text-xs text-secondary">No active district assigned</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <MapPin className="size-5 text-accent" aria-hidden />
          <p className="mt-3 text-xs text-secondary">Current residence</p>
          <p className="mt-1 text-lg font-semibold text-foreground">Unassigned</p>
          <p className="mt-1 text-xs text-secondary">Residence starts after geography approval</p>
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
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <ShieldCheck className="size-5 text-accent" aria-hidden />
          Identity, citizenship and residence are separate
        </h2>
        <p className="mt-3 text-sm leading-7 text-secondary">
          Your existing SIMVERSE identity remains permanent. Official fictional
          citizenship requires its own reviewed process, while residence requires
          an active, approved district. A preferred nationality or pilot interest
          is neither of those things. Your profile is private by default.
        </p>
        <p className="mt-3 text-xs text-secondary">
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
