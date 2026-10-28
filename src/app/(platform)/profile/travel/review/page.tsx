import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireUser } from "@/server/context";
import { getVirtualTravelReviewQueue } from "@/server/services/player-travel-service";
import { PlayerTravelReviewPanel } from "@/components/player/player-travel-review-panel";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Virtual Visa Review | SIMVERSE" };
export default async function VirtualTravelReviewPage() {
  const user = await requireUser();
  // AuthorizationError for users without country-scoped reviewer grant.
  const queue = await getVirtualTravelReviewQueue(user.id);
  return <div className="mx-auto max-w-4xl space-y-5">
    <PageHeader icon={ClipboardCheck} title="SIMVERSE Virtual Visa Reviews"
      description="Country-scoped, reviewer-only virtual entry visa decisions."/>
    <Link href="/profile/travel" className="text-sm font-semibold text-accent hover:underline">← Virtual travel center</Link>
    <PlayerTravelReviewPanel initial={queue.applications}/>
  </div>;
}
