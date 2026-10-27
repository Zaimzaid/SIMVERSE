import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EconomyLabPanel } from "@/components/economy/economy-lab-panel";
import { requirePlatformContext } from "@/server/context";
import { listEconomyLabs } from "@/server/services/economy-lab-service";

export const metadata: Metadata = { title: "Economy Lab | SIMVERSE" };
export default async function EconomyLabPage() {
  const ctx = await requirePlatformContext();
  const labs = await listEconomyLabs(ctx.user.id, ctx.workspace.id);
  return <div className="mx-auto max-w-6xl space-y-6">
    <PageHeader icon={Landmark} title="Economy Lab"
      description="See how AI citizens, businesses, wages and government spending fit together in a small playable economic prototype."/>
    <EconomyLabPanel initialLabs={labs}/>
  </div>;
}
