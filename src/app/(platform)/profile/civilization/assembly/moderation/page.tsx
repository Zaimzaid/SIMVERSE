import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import { listMyModeratedDistricts, getDistrictModerationQueue } from "@/server/services/district-assembly-service";
import { DistrictModerationClient } from "@/components/civilization/district-moderation-client";

export const metadata: Metadata = { title: "District Assembly Moderation | KAVANDRO", robots: { index: false } };
export default async function DistrictModerationPage() {
  const user = await requireUser();
  const memberships = await listMyModeratedDistricts(user.id);
  const district = memberships.districts[0];
  const queue = district ? await getDistrictModerationQueue(user.id, district.id) : null;
  return <main className="mx-auto max-w-5xl space-y-6">
    <Link href="/profile/civilization/assembly" className="text-sm font-semibold text-accent hover:underline">← District Assembly</Link>
    <h1 className="text-3xl font-semibold text-foreground">Restricted district moderation</h1>
    {queue && district
      ? <DistrictModerationClient districtId={district.id} queue={queue}/>
      : <p className="text-sm text-secondary">No active district is available for review.</p>}
  </main>;
}
