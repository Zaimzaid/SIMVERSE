import type { Metadata } from "next";
import Link from "next/link";
import { FileBadge2 } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyPlayerIdentity } from "@/server/services/player-identity-service";
import { getMyVirtualDocuments } from "@/server/services/player-document-service";
import { PlayerDocumentCenter } from "@/components/player/player-document-center";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Virtual Citizenship & Documents | SIMVERSE" };

export default async function MyVirtualDocumentsPage() {
  const user = await requireUser();
  const [identity, docs] = await Promise.all([
    getMyPlayerIdentity(user.id), getMyVirtualDocuments(user.id),
  ]);
  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader icon={FileBadge2} title="Citizenship & Virtual Documents"
      description="Manage fictional SIMVERSE citizenship, domestic and international travel-document applications." />
    <Link href="/profile" className="inline-block text-sm font-semibold text-accent hover:underline">← Back to my player identity</Link>
    <PlayerDocumentCenter initial={docs} username={identity.username} homeCountryId={identity.homeCountryId}/>
  </div>;
}
