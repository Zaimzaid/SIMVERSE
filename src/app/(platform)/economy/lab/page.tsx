import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EconomyLabPanel } from "@/components/economy/economy-lab-panel";
import { requirePlatformContext } from "@/server/context";
import { getEconomyLab, listEconomyLabs } from "@/server/services/economy-lab-service";

export const metadata: Metadata = { title: "Economy Lab | SIMVERSE" };
export default async function EconomyLabPage() {
  const ctx = await requirePlatformContext();
  const labs = await listEconomyLabs(ctx.user.id, ctx.workspace.id);
  const first = labs[0];
  const detail = first ? await getEconomyLab(ctx.user.id, ctx.workspace.id, first.id) : null;
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="simverse-page-scene simverse-page-scene--economy">
      <PageHeader icon={Landmark} title="Economy Lab"
        description="Join a living town, invest in an approved business and watch AI customers, wages, shops and government interact."/>
    </div>
    <EconomyLabPanel initialLabs={labs} initialDetail={detail}
      canCreate={ctx.permissions.includes("world.manage")}/>
  </div>;
}
