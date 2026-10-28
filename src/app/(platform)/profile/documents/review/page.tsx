import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireUser } from "@/server/context";
import { getVirtualDocumentReviewQueue } from "@/server/services/player-document-service";
import { VirtualDocumentReviewPanel } from "@/components/player/virtual-document-review-panel";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Virtual Document Reviews | SIMVERSE" };
export default async function VirtualDocumentReviewPage() {
  const user = await requireUser();
  // Throws AuthorizationError if this player has no explicit reviewer grant.
  const { applications } = await getVirtualDocumentReviewQueue(user.id);
  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader icon={ClipboardCheck} title="SIMVERSE Country Document Reviews"
      description="Country-scoped fictional citizenship, residency and passport approval queue."/>
    <Link href="/profile/documents" className="text-sm font-semibold text-accent hover:underline">← My virtual documents</Link>
    <VirtualDocumentReviewPanel initial={applications}/>
  </div>;
}
