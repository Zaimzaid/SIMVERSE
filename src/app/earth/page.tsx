import type { Metadata } from "next";
import { CircleDot, Globe2, ShieldCheck } from "lucide-react";
import { PublicEarthExplorer } from "@/components/earth/public-earth-explorer";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/server/context";
import { getPublicEarthOverview } from "@/server/services/earth-public-service";

export const metadata: Metadata = {
  title: "Explore Earth",
  description: "Explore the real world through SIMVERSE's interactive 3D Earth experience.",
};

export default async function EarthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [overview, user, params] = await Promise.all([
    getPublicEarthOverview(),
    getCurrentUser(),
    searchParams,
  ]);
  const rawStatus = typeof params.intentStatus === "string" ? params.intentStatus : undefined;
  const intentStatus = rawStatus === "expired" || rawStatus === "unavailable"
    ? rawStatus
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader authed={Boolean(user)} />
      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="aurora" aria-hidden />
          <div className="absolute inset-0 grid-overlay" aria-hidden />
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-20 lg:px-8">
            <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <div>
                <Badge variant="accent">
                  <CircleDot className="size-3" />SIMVERSE Earth · Live foundation
                </Badge>
                <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold leading-[1.03] text-foreground sm:text-6xl lg:text-7xl">
                  The real world,
                  <span className="text-gradient block">ready to explore.</span>
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
                  Rotate a real geographic globe, discover verified SIMVERSE coverage, and carry your chosen destination securely into the protected Earth explorer.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
                  <Globe2 className="size-5 text-accent" />
                  <p className="mt-3 text-2xl font-semibold text-foreground">3D</p>
                  <p className="text-xs text-secondary">MapLibre globe</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
                  <ShieldCheck className="size-5 text-success" />
                  <p className="mt-3 text-2xl font-semibold text-foreground">Safe</p>
                  <p className="text-xs text-secondary">Public projection</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[96rem] px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          <PublicEarthExplorer
            overview={overview}
            authenticated={Boolean(user)}
            intentStatus={intentStatus}
          />
        </section>

        <section className="border-t border-border bg-surface/30">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              ["Real geography", "Global context comes from pinned Natural Earth data. Catalog places retain their reviewed Phase 2 provenance."],
              ["Honest coverage", "Nigeria is the current verified country. Lagos locality remains a sourced point, never a fabricated city boundary."],
              ["Protected continuation", "Location detail, hierarchy and workspace context are resolved only after authentication and authorization."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-border bg-background/40 p-5">
                <h2 className="font-display font-semibold text-foreground">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
