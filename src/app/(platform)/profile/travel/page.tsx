import type { Metadata } from "next";
import { Plane } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyVirtualTravelCenter } from "@/server/services/player-travel-service";
import { PlayerTravelCenter } from "@/components/player/player-travel-center";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Virtual Travel & Immigration | SIMVERSE" };
export default async function MyVirtualTravelPage() {
  const user = await requireUser();
  const travel = await getMyVirtualTravelCenter(user.id);
  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader icon={Plane} title="Travel & Immigration"
      description="Fictional SIMVERSE border-route checks, virtual visas and residency qualifications."/>
    <PlayerTravelCenter initial={travel}/>
  </div>;
}
