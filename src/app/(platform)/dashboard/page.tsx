import Link from "next/link";
import {
  ArrowRight, Compass, FileBadge2, Globe2, MapPinned,
  MessageCircle, ShieldCheck, Sparkles, Swords, Users,
  WalletCards,
} from "lucide-react";
import { requirePlatformContext } from "@/server/context";

/**
 * Build Your Civilization: first citizen-oriented dashboard.
 *
 * This is a safe UI transition, not a claim that district membership, virtual
 * treasuries, games, or fictional country publication are already live.
 * Existing creator work remains accessible from the advanced account menu.
 */
export default async function DashboardPage() {
  const ctx = await requirePlatformContext();
  const firstName = ctx.user.displayName.split(/\s+/)[0] || ctx.user.displayName;

  const places = [
    {
      label: "My founding journey",
      detail: "Set up your public identity and save a founding-country preference without claiming automatic citizenship.",
      href: "/welcome",
      icon: Sparkles,
      marker: "Get started",
    },
    {
      label: "Preview the planet",
      detail: "Explore the new fictional globe prototype. Countries are not yet published.",
      href: "/planet",
      icon: Globe2,
      marker: "Visual preview",
    },
    {
      label: "My future civilization",
      detail: "Save a founding-country preference and express interest in the proposed pilot district.",
      href: "/profile/civilization",
      icon: MapPinned,
      marker: "Phase 3 preview",
    },
    {
      label: "My identity",
      detail: "View your existing player profile and historical SIMVERSE citizenship records.",
      href: "/profile",
      icon: FileBadge2,
      marker: "Available",
    },
    {
      label: "Friends & messages",
      detail: "Meet people through the existing community and messaging features.",
      href: "/social",
      icon: Users,
      marker: "Available",
    },
    ...(ctx.permissions.includes("simulation.view")
      ? [{
        label: "Anything Wars",
        detail: "Visit the existing simulation and event area; district rewards are not connected yet.",
        href: "/anything-wars",
        icon: Swords,
        marker: "Existing experience",
      }]
      : []),
  ];

  const upcoming = [
    {
      icon: MapPinned,
      title: "My District",
      detail: "A citizen-led district, assembly and undeveloped territory will appear here once activated.",
    },
    {
      icon: MessageCircle,
      title: "Build Our World",
      detail: "Suggest developments, discuss locations and take part in reviewed district decisions.",
    },
    {
      icon: WalletCards,
      title: "Vascoin & Treasury",
      detail: "Future in-world rewards and voluntary contributions to approved community projects.",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-9">
      <section className="simverse-home-hero relative isolate overflow-hidden rounded-3xl border border-border shadow-xl">
        <div className="relative z-10 flex min-h-[330px] flex-col justify-center gap-6 p-6 sm:p-9 lg:pr-[25%]">
          <div className="max-w-2xl">
            <span className="hero-eyebrow inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.17em]">
              <Sparkles className="size-3.5" aria-hidden /> Build Your Civilization
            </span>
            <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Welcome to KAVANDRO, {firstName}.
            </h1>
            <p className="hero-description mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
              A new world is taking shape. Explore the planet preview, connect with citizens
              and follow the journey toward communities that will shape their own districts.
            </p>
            <p className="mt-3 max-w-xl text-xs text-secondary">
              Citizen-led districts, construction, Vascoin and their competitions are in development,
              not yet active gameplay.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/planet"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
              <Compass className="size-4" /> View planet preview <ArrowRight className="size-4" />
            </Link>
            <Link href="/social"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/75 px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface-hover">
              <Users className="size-4" /> Open community
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="citizen-available-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">Start exploring</p>
          <h2 id="citizen-available-heading" className="mt-1 font-display text-xl font-semibold text-foreground">
            What you can access today
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {places.map(({ label, detail, href, icon: Icon, marker }) => (
            <Link key={href} href={href}
              className="group flex min-h-40 flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition hover:border-accent/50 hover:bg-surface-hover">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-xl bg-accent-soft p-3 text-accent"><Icon className="size-5" aria-hidden /></span>
                <ArrowRight className="size-4 text-muted group-hover:text-accent" aria-hidden />
              </div>
              <div className="mt-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{marker}</p>
                <h3 className="font-semibold text-foreground">{label}</h3>
                <p className="mt-1 text-xs leading-relaxed text-secondary">{detail}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="citizen-upcoming-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">Development roadmap</p>
          <h2 id="citizen-upcoming-heading" className="mt-1 font-display text-xl font-semibold text-foreground">
            What's coming to your civilization
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {upcoming.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-xl border border-border bg-background/70 p-2.5 text-secondary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted">
                  Planned
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-secondary">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-xl border border-border bg-surface p-4 text-xs leading-relaxed text-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        No country, district, land ownership or virtual currency balance is granted by this preview.
        Your existing account, creations and authorized creator tools remain preserved.
      </p>
    </div>
  );
}
