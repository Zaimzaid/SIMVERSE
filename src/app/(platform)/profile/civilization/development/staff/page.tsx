import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import {
  getStaffDevelopmentQueue, listMyDevelopmentStaffDistricts,
} from "@/server/services/founding-development-service";
import { DevelopmentStaffClient } from "@/components/civilization/development-staff-client";

export const metadata: Metadata = {
  title: "Development Feasibility Staff | KAVANDRO",
  robots: { index: false, follow: false },
};

export default async function DevelopmentStaffPage() {
  const user = await requireUser();
  const list = await listMyDevelopmentStaffDistricts(user.id);
  const district = list.districts[0];
  const queue = district ? await getStaffDevelopmentQueue(user.id, district.id) : null;
  return <main className="mx-auto max-w-5xl space-y-6">
    <Link href="/profile/civilization/development"
      className="text-sm font-semibold text-accent hover:underline">← Development overview</Link>
    <header>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        Restricted staff · Phase 8
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">Development feasibility</h1>
      <p className="mt-3 text-sm leading-7 text-secondary">
        Authorized staff can review shortlisted proposals. This interface cannot
        allocate land, approve a construction contract or spend treasury funds.
      </p>
    </header>
    {queue ? <DevelopmentStaffClient initial={queue} /> : <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-foreground">Independent staff authorization required</h2>
      <p className="mt-2 text-sm leading-7 text-secondary">
        No active development staff grant exists for this account. Citizenship,
        district moderator, owner or creator status does not confer staff feasibility authority.
      </p>
    </section>}
  </main>;
}
