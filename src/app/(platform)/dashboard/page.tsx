import Link from "next/link";
import {
  ArrowRight, Compass, FileBadge2, Globe2, MapPinned,
  MessageCircle, ShieldCheck, Sparkles, Swords, Users,
  WalletCards, Puzzle, Landmark,
} from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { getPlatformStaff } from "@/server/admin/access";

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
  const platformStaff = await getPlatformStaff(ctx.user.id);

  const places = [
    {
      label: "My founding journey",
      detail: "Set up your public identity and save a founding-country preference without claiming automatic citizenship.",
      href: "/welcome",
      icon: Sparkles,
      marker: "Get started",
    },
    {
      label: "Explore the concept world",
      detail: "Explore the original five-continent atlas and ten draft country locations. Nothing is published yet.",
      href: "/planet/planning/map",
      icon: Globe2,
      marker: "Country concept atlas",
    },
    {
      label: "Daily Citizen Challenge",
      detail: "Play a non-3D daily planning puzzle and compare anonymous scores. No in-world credits or official changes.",
      href: "/profile/civilization/challenge",
      icon: Puzzle,
      marker: "Playable · Fictional tokens",
    },
    {
      label: "My future civilization",
      detail: "Save a founding-country preference and express interest in the proposed pilot district.",
      href: "/profile/civilization",
      icon: MapPinned,
      marker: "Preference form available",
    },
    {
      label: "My identity",
      detail: "View your existing player profile and existing virtual citizenship records.",
      href: "/profile",
      icon: FileBadge2,
      marker: "Available",
    },
    {
      label: "My District Club",
      detail: "Meet residents in friendly district chat rooms when official membership becomes active.",
      href: "/profile/civilization/club",
      icon: MessageCircle,
      marker: "Residents-only · Gated",
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

  // These pages and services exist. Some are restricted until an official
  // founding country, district, residence, or staff grant is activated.
  // Don't describe implemented tools as "Planned" or pretend they're live.
  const civilizationTools = [
    {
      icon: Users, title: "District Assembly", href: "/profile/civilization/assembly",
      status: "Built · District required",
      detail: "Open the proposals and advisory-vote interface. Membership requires an approved active district.",
    },
    {
      icon: WalletCards, title: "Vascoin Wallet", href: "/profile/civilization/vascoin",
      status: "Built · Eligibility applies",
      detail: "View virtual wallet and daily check-in controls. Credits require the relevant platform and district conditions.",
    },
    {
      icon: MessageCircle, title: "District Club", href: "/profile/civilization/club",
      status: "Built · District required",
      detail: "District chat, interest groups, community events and safety tools; access is restricted to eligible residents.",
    },
    {
      icon: MapPinned, title: "Land & Zoning", href: "/profile/civilization/land",
      status: "Built · Planner access",
      detail: "Open the schematic planning tool. Editing requires an authorized planner; these are not owned parcels.",
    },
    {
      icon: Landmark, title: "District Development", href: "/profile/civilization/development",
      status: "Built · District required",
      detail: "Follow district proposals and feasibility reviews when an approved district and projects exist.",
    },
    {
      icon: Puzzle, title: "Daily Citizen Challenge", href: "/profile/civilization/challenge",
      status: "Playable now",
      detail: "Play the daily non-3D civic strategy puzzle with an anonymous scoreboard.",
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
              The civilization tools below are developed. Community governance, currency activity and
              land planning remain gated until the necessary districts and permissions are activated.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/planet/planning/map"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
              <Compass className="size-4" /> Explore the concept atlas <ArrowRight className="size-4" />
            </Link>
            <Link href="/social"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/75 px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface-hover">
              <Users className="size-4" /> Open community
            </Link>
            {platformStaff?.active ? <Link href="/admin/access"
              className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm font-semibold text-accent hover:bg-surface-hover">
              <ShieldCheck className="size-4"/> Administration
            </Link> : null}
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

      <section aria-labelledby="citizen-tools-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">Implemented features</p>
          <h2 id="citizen-tools-heading" className="mt-1 font-display text-xl font-semibold text-foreground">
            Civilization tools you can open
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-secondary">
            These pages are developed, but some actions require a published founding
            country, approved district, active citizenship or staff permission.
            You can inspect the page and its eligibility message without seeing a misleading "Planned" label.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {civilizationTools.map(({ icon: Icon, title, href, detail, status }) => (
            <Link key={href} href={href}
              className="group rounded-2xl border border-border bg-surface p-5 transition hover:border-accent/50 hover:bg-surface-hover">
              <div className="flex items-center justify-between">
                <span className="rounded-xl border border-border bg-background/70 p-2.5 text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <ArrowRight className="size-4 text-muted group-hover:text-accent" aria-hidden />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-accent">{status}</p>
              <h3 className="mt-1 font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-secondary">{detail}</p>
            </Link>
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
