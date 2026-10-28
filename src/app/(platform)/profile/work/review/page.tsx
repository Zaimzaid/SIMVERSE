import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireUser } from "@/server/context";
import { getBusinessReviewQueue } from "@/server/services/player-training-business-service";
import { PageHeader } from "@/components/ui/page-header";
import { BusinessReviewQueue } from "@/components/player/business-review-queue";

export const metadata: Metadata = { title: "Virtual Business Reviews | SIMVERSE" };
export default async function PlayerBusinessReviewPage() {
  const user = await requireUser();
  const { businesses } = await getBusinessReviewQueue(user.id);
  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader icon={ClipboardCheck} title="SIMVERSE Virtual Business Reviews"
      description="Independent review of simulated company drafts before enabling in-world job posts." />
    <Link href="/profile/work" className="text-sm font-semibold text-accent hover:underline">← My work center</Link>
    <BusinessReviewQueue initial={businesses} />
  </div>;
}
