import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, Flag, ShieldCheck, UserRound, Users } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyPlayerIdentity } from "@/server/services/player-identity-service";
import { getMyFoundingCitizenInterest } from "@/server/services/founding-citizen-interest-service";

export const metadata: Metadata = {
  title: "Welcome to KAVANDRO",
  description: "Begin your founding-citizen journey without automatically granting citizenship or district access.",
};

/** Guided onboarding works with existing persisted profile/interest records.
 * No fictional citizenship, residence, Vascoin or voting rights are issued here.
 */
export default async function CitizenWelcomePage() {
  const user = await requireUser();
  const [identity, interest] = await Promise.all([
    getMyPlayerIdentity(user.id),
    getMyFoundingCitizenInterest(user.id),
  ]);

  const steps = [
    {
      title: "Create your citizen profile",
      description: identity.username
        ? `You are known as @${identity.username}. Review your profile and privacy settings.`
        : "Choose a username and decide what to share with other citizens.",
      href: "/profile",
      cta: identity.username ? "View my profile" : "Complete my profile",
      done: Boolean(identity.username),
      icon: UserRound,
    },
    {
      title: "Choose a founding-world preference",
      description: interest.preferredNationName
        ? `Your current preference is ${interest.preferredNationName}. This does not grant citizenship.`
        : "Learn about the ten founding countries and save the one that interests you.",
      href: "/profile/civilization",
      cta: interest.preferredNationName ? "Review my preference" : "Choose my preference",
      done: Boolean(interest.preferredNationName),
      icon: Flag,
    },
    {
      title: "Explore the fictional world",
      description: "Explore our original planet and concept atlas. The country boundaries are planning sketches, not published territories.",
      href: "/planet/planning/map",
      cta: "View concept world map",
      done: false,
      icon: Compass,
    },
    {
      title: "Meet the community",
      description: "Use existing friends and messaging. District councils and voting open only after geographic and citizenship review.",
      href: "/social",
      cta: "Open community",
      done: false,
      icon: Users,
    },
  ] as const;

  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <div className="rounded-3xl border border-border bg-surface p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          KAVANDRO · Founding citizen journey
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Welcome, {user.displayName}.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary sm:text-base">
          Build Your Civilization starts with the people who will shape it. Set up your identity,
          choose what you want to explore and help imagine the future of your community.
        </p>
        <p className="mt-4 text-sm font-medium text-accent">
          {Number(Boolean(identity.username)) + Number(Boolean(interest.preferredNationName))} of 2 founding profile steps completed
        </p>
      </div>

      <section aria-label="Your KAVANDRO starting steps" className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.href} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-accent-soft p-3 text-accent"><Icon className="size-5" aria-hidden /></span>
                {step.done ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <CheckCircle2 className="size-4" aria-hidden /> Saved
                  </span>
                ) : <span className="text-xs text-muted">Step {index + 1}</span>}
              </div>
              <h2 className="mt-4 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-secondary">{step.description}</p>
              <Link href={step.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
                {step.cta} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </article>
          );
        })}
      </section>

      <p className="flex items-start gap-2 rounded-xl border border-border bg-surface p-4 text-sm leading-6 text-secondary">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        Selecting a nation or exploring a district does not grant nationality, residence, voting rights,
        land ownership or virtual funds. Those require separately reviewed, active in-world systems.
      </p>
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
        Continue to my dashboard <ArrowRight className="size-4" aria-hidden />
      </Link>
    </main>
  );
}
