import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CircleDot,
  Clapperboard,
  Globe2,
  Layers,
  Play,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/server/context";
import { PRODUCTS } from "@/lib/products";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const ARCHITECTURE = [
  {
    name: "Products",
    description:
      "Polished, ready-to-play experiences — Anything Wars, Robot Arena, and more — assembled from modules.",
    status: "Upcoming",
    live: false,
  },
  {
    name: "Modules",
    description:
      "Reusable simulation capabilities: battle, racing, economy, physics, and beyond.",
    status: "Upcoming",
    live: false,
  },
  {
    name: "Core",
    description:
      "The deterministic simulation runtime that powers every entity, world, and outcome.",
    status: "Upcoming",
    live: false,
  },
  {
    name: "Platform",
    description:
      "Accounts, workspaces, teams, permissions, assets, analytics, and creator tools.",
    status: "Live now",
    live: true,
  },
];

const STEPS = [
  {
    icon: Boxes,
    title: "Create entities",
    body: "Define the things that live in your world — their traits, stats, and behaviors.",
  },
  {
    icon: Globe2,
    title: "Build worlds",
    body: "Compose environments and rules that shape how entities interact.",
  },
  {
    icon: Play,
    title: "Run simulations",
    body: "Press play and let the runtime resolve thousands of outcomes deterministically.",
  },
  {
    icon: Clapperboard,
    title: "Turn outcomes into stories",
    body: "Capture the drama and export highlights, recaps, and shareable content.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader authed={Boolean(user)} />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="aurora" aria-hidden="true" />
          <div className="absolute inset-0 grid-overlay" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-40">
            <Badge variant="accent" className="mx-auto mb-8">
              <CircleDot className="size-3" />
              One platform. Infinite worlds.
            </Badge>

            <p className="text-gradient font-display text-4xl font-bold uppercase tracking-[0.3em] sm:text-6xl lg:text-7xl">
              Simverse
            </p>

            <h1 className="mt-8 font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-6xl">
              Simulate anything.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-secondary">
              Build worlds. Create entities. Run simulations. Turn outcomes into
              stories.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={user ? "/dashboard" : "/register"}
                className={buttonClasses({ variant: "primary", size: "lg" })}
              >
                Enter SIMVERSE
                <ArrowRight className="size-4" />
              </Link>
              <a href="#how" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                Learn more
              </a>
            </div>

            <p className="mt-8 text-xs font-medium uppercase tracking-wider text-muted">
              Phase 0 · Platform foundation available now
            </p>
          </div>
        </section>

        {/* Architecture */}
        <section id="platform" className="border-t border-border bg-surface/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="outline" className="mx-auto mb-4">
                <Layers className="size-3" />
                Platform architecture
              </Badge>
              <h2 className="font-display text-3xl font-semibold text-foreground">
                Four layers, one universe
              </h2>
              <p className="mt-3 text-secondary">
                SIMVERSE is built in distinct layers. The platform foundation is
                live today; the simulation runtime, modules, and products build on
                top of it.
              </p>
            </div>

            <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-3">
              {ARCHITECTURE.map((layer) => (
                <Card
                  key={layer.name}
                  className={
                    layer.live
                      ? "border-accent/40 bg-accent-soft/40 p-5"
                      : "p-5 opacity-90"
                  }
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">
                          {layer.name}
                        </h3>
                        <Badge variant={layer.live ? "success" : "neutral"}>
                          {layer.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-secondary">{layer.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="outline" className="mx-auto mb-4">
                <Sparkles className="size-3" />
                How SIMVERSE works
              </Badge>
              <h2 className="font-display text-3xl font-semibold text-foreground">
                From idea to story in four steps
              </h2>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <Card key={step.title} className="p-6">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-background/50 text-accent">
                    <step.icon className="size-5" />
                  </span>
                  <p className="mt-4 text-xs font-semibold text-muted">
                    STEP {i + 1}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-secondary">{step.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Products */}
        <section id="products" className="border-t border-border bg-surface/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="outline" className="mx-auto mb-4">
                Products
              </Badge>
              <h2 className="font-display text-3xl font-semibold text-foreground">
                Worlds worth building
              </h2>
              <p className="mt-3 text-secondary">
                A glimpse of what creators will launch on SIMVERSE. These products
                are concepts in active development — not yet playable.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PRODUCTS.map((product) => (
                <Card key={product.name} className="flex flex-col p-6">
                  <div className="flex items-start justify-between">
                    <span
                      className={`inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${product.gradient} text-foreground`}
                    >
                      <product.icon className="size-6" />
                    </span>
                    <Badge variant={product.status === "In development" ? "accent" : "neutral"}>
                      {product.status}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {product.name}
                  </h3>
                  <p className="mt-1.5 flex-1 text-sm text-secondary">
                    {product.tagline}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border">
          <div className="relative mx-auto w-full max-w-5xl overflow-hidden px-4 py-20 text-center sm:px-6">
            <div className="aurora" aria-hidden="true" />
            <div className="relative">
              <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
                Your simulation universe starts here.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-secondary">
                Create your free workspace and explore the SIMVERSE platform.
              </p>
              <div className="mt-8">
                <Link
                  href={user ? "/dashboard" : "/register"}
                  className={buttonClasses({ variant: "primary", size: "lg" })}
                >
                  {user ? "Go to dashboard" : "Create your workspace"}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
