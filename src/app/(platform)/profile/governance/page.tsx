import type { Metadata } from "next";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyVirtualGovernance } from "@/server/services/player-governance-service";
import { PageHeader } from "@/components/ui/page-header";
import { CountryGovernanceDesk } from "@/components/player/country-governance-desk";

export const metadata: Metadata = { title: "Country Governance | SIMVERSE" };
export default async function CountryGovernancePage() {
  const user = await requireUser();
  // Country governance grants are independent of ordinary workspace admin
  // and Phase 2 document reviewer privileges. No grant => 403.
  const data = await getMyVirtualGovernance(user.id);
  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader icon={Landmark} title="SIMVERSE Virtual Country Governance"
      description="Manage fictional citizenship policy versions and bilateral travel agreements with separate approvals."/>
    <Link href="/profile/travel" className="inline-block text-sm font-semibold text-accent hover:underline">
      ← Return to player travel dashboard
    </Link>
    <CountryGovernanceDesk initial={data} myUserId={user.id}/>
  </div>;
}
