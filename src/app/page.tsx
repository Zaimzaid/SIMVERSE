import Link from "next/link";
import {
  ArrowRight, Compass, Flag, Globe2, MessageCircle,
  ShieldCheck, Sparkles, Trophy, Users,
} from "lucide-react";
import { getCurrentUser } from "@/server/context";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const JOURNEY = [
  {
    icon: Flag,
    title: "Become a citizen",
    detail: "Choose your fictional nationality and join a district community when it opens.",
  },
  {
    icon: Users,
    title: "Join your district",
    detail: "Discuss the future of an initially undeveloped place with other citizens.",
  },
  {
    icon: Trophy,
    title: "Play and participate",
    detail: "Enjoy challenges and future competitions as your community grows.",
  },
  {
    icon: MessageCircle,
    title: "Build your civilization",
    detail: "Propose, discuss and help prioritize developments delivered by the SIMVERSE team.",
  },
] as const;

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader authed={Boolean(user)} />
      <main className="flex-1">
        <section className="simverse-public-hero relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="absolute inset-0 grid-overlay opacity-10" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-40">
            <Badge variant="accent" className="mx-auto mb-8">
              <Sparkles className="size-3" /> A new virtual society is taking shape
            </Badge>
            <p className="text-gradient font-display text-4xl font-bold uppercase tracking-[0.3em] sm:text-6xl lg:text-7xl">
              SIMVERSE
            </p>
            <h1 className="mt-8 font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-6xl">
              Build Your Civilization
            </h1>
            <p className="hero-description mx-auto mt-5 max-w-2xl text-lg">
              Explore a fictional planet, connect with people and take part in the future of
              communities that will develop from undeveloped land.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={user ? "/dashboard" : "/register"}
                className={buttonClasses({ variant: "primary", size: "lg" })}>
                {user ? "Enter your dashboard" : "Explore SIMVERSE"}
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/planet" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                <Globe2 className="size-4" /> Planet preview
              </Link>
            </div>
            <p className="mt-8 text-xs font-medium text-muted">
              Early development preview — fictional countries, district construction and Vascoin
              are not yet live features.
            </p>
          </div>
        </section>

        <section id="platform" className="border-t border-border bg-surface/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="outline" className="mx-auto mb-4"><Globe2 className="size-3" /> Our vision</Badge>
              <h2 className="font-display text-3xl font-semibold text-foreground">
                A world whose future is shaped by its citizens
              </h2>
              <p className="mt-3 text-secondary">
                SIMVERSE plans to establish ten fictional founding countries and district communities.
                Citizens will influence what gets built and where, while SIMVERSE reviews and implements
                feasible projects. The world will grow through games, participation and collaboration.
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="outline" className="mx-auto mb-4"><Compass className="size-3" /> Proposed citizen experience</Badge>
              <h2 className="font-display text-3xl font-semibold text-foreground">How it will work</h2>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map((step, index) => (
                <article key={step.title} className="rounded-2xl border border-border bg-surface p-6">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-background/50 text-accent">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-4 text-xs font-semibold text-muted">STEP {index + 1} · PLANNED</p>
                  <h3 className="mt-1 font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{step.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="products" className="border-t border-border bg-surface/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-semibold text-foreground">What's available today?</h2>
            <p className="mt-3 max-w-3xl text-secondary">
              The current development build contains account and profile features,
              social messaging, existing simulation tools and a visual prototype of
              the fictional planet. A playable district economy and citizen-built world
              are still in development.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/planet" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                <Globe2 className="size-4" /> View globe prototype
              </Link>
              <Link href={user ? "/social" : "/register"}
                className={buttonClasses({ variant: "secondary", size: "lg" })}>
                <Users className="size-4" /> {user ? "Open community" : "Join the preview"}
              </Link>
            </div>
            <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              This is not a live claim of published fictional countries, virtual land rights,
              citizen-led construction or spendable Vascoin.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
