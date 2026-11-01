import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Globe2, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/context";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { CivilizationGlimpse } from "@/components/marketing/civilization-glimpse";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_DESCRIPTION, BRAND_PREVIEW_NOTICE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description: BRAND_DESCRIPTION,
};

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader authed={Boolean(user)} simple />

      <main id="main-content" className="flex flex-1 flex-col">
        <section className="simverse-landing-hero relative isolate flex flex-1 items-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-overlay opacity-20" aria-hidden="true" />

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(330px,0.92fr)] lg:gap-14 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <span className="hero-eyebrow inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft/70 px-3 py-1.5 text-xs font-semibold tracking-wide text-accent">
                <Sparkles className="size-3.5" aria-hidden="true" /> A new virtual world is taking shape
              </span>

              <h1 className="mt-6 font-display text-5xl font-bold leading-[1.06] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                Build your <span className="text-gradient">civilization.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-secondary sm:text-lg">
                Explore a new world. Meet people. And help shape the communities
                we&apos;ll build together.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href={user ? "/dashboard" : "/register"}
                  className={buttonClasses({ variant: "primary", size: "lg", className: "min-h-12 px-6" })}>
                  {user ? "Go to my dashboard" : "Join KAVANDRO"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link href="/planet"
                  className={buttonClasses({ variant: "secondary", size: "lg", className: "min-h-12 border-border-strong bg-background/85 px-6" })}>
                  <Globe2 className="size-4" aria-hidden="true" />
                  Explore the planet
                </Link>
              </div>

              <p className="mt-7 max-w-lg border-l-2 border-accent/40 pl-3 text-sm leading-6 text-secondary">
                {BRAND_PREVIEW_NOTICE}
              </p>
            </div>

            <CivilizationGlimpse />
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background/95">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-3 px-4 py-5 text-sm text-secondary sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <Logo size="sm" />
          <p>© {new Date().getFullYear()} {BRAND_NAME} · A world shaped together.</p>
          <Link href="/planet" className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
            Preview the planet
          </Link>
        </div>
      </footer>
    </div>
  );
}
