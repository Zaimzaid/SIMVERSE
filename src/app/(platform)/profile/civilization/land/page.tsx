import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import {
  listMyLandPlans, getDistrictLandPlan,
} from "@/server/services/land-planning-service";
import { LandPlanningBoard } from "@/components/civilization/land-planning-board";

export const metadata: Metadata = {
  title: "District Land Planning | SIMVERSE",
  robots: { index: false, follow: false },
};

export default async function DistrictLandPlanningPage() {
  const user = await requireUser();
  const available = await listMyLandPlans(user.id);
  const district = available.availableDistricts[0];
  const plan = district ? await getDistrictLandPlan(user.id, district.id) : null;
  return <main className="mx-auto max-w-5xl space-y-6">
    <Link href="/profile/civilization" className="inline-block text-sm font-semibold text-accent hover:underline">
      ← My Civilization
    </Link>
    <header>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        Phase 7 · Build Your Civilization
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
        Land & zoning planner
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
        Plan protected ecological areas, public corridors and possible future development zones.
        These are schematic diagrams, not approved geography or sellable plots.
      </p>
    </header>
    {!district && <div className="rounded-xl border border-border bg-surface p-5 text-sm leading-7 text-secondary">
      No district land-planning privileges are active for this account. The diagram below uses
      clearly labeled example shapes only. Real land zoning awaits approved district boundaries
      and independently granted planning permissions.
    </div>}
    <LandPlanningBoard initial={plan}/>
    <p className="rounded-xl border border-border bg-surface p-4 text-sm leading-7 text-secondary">
      {available.notice} No land parcels can be claimed, developed or purchased through this page.
    </p>
  </main>;
}
