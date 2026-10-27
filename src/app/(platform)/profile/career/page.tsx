import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyEconomicIdentity } from "@/server/services/player-economy-service";
import { PlayerEconomyCenter } from "@/components/player/player-economy-center";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "My Career & SIMVERSE Wallet" };
export default async function PlayerEconomicIdentityPage() {
  const user = await requireUser();
  const economy = await getMyEconomicIdentity(user.id);
  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader icon={BriefcaseBusiness} title="My Career & Economy"
      description="Select a fictional profession, see your starting SIMVERSE Credits and plan virtual businesses." />
    <Link href="/profile" className="inline-block text-sm font-semibold text-accent hover:underline">
      ← Back to My SIMVERSE Profile
    </Link>
    <PlayerEconomyCenter initial={economy} />
  </div>;
}
