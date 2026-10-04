import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS } from "@/lib/assets/constants";
import { NotFoundError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { getAsset, listAssetVersions } from "@/server/services/asset-service";
import { assetStatusVariant } from "@/components/assets/asset-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
export const metadata: Metadata = { title: "Asset version history" };
export default async function AssetVersionsPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params; const { user, workspace } = await requirePlatformContext();
  let asset; try { asset = await getAsset(user.id, workspace.id, assetId); } catch (error) { if (error instanceof NotFoundError) notFound(); throw error; }
  const versions = await listAssetVersions(user.id, workspace.id, asset.id);
  return <div className="space-y-6"><Link href={`/assets/${asset.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />{asset.name}</Link>
    <PageHeader icon={History} title="Version history" description="Immutable metadata snapshots. Current edits append a version and never rewrite these records." />
    <div className="space-y-4">{versions.map((version) => <Card key={version.id}><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Version {version.version}{version.version === asset.currentVersion ? " · Current" : ""}</CardTitle><p className="mt-1 text-sm text-muted">{version.createdAt.toLocaleString()} · {version.createdByName ?? "Unknown creator"}</p></div><Badge variant={assetStatusVariant(version.status)}>{ASSET_STATUS_LABELS[version.status]}</Badge></CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-3"><div><p className="text-xs uppercase text-muted">Identity</p><p className="mt-1 font-medium">{version.name}</p><p className="text-secondary">{ASSET_TYPE_LABELS[version.type]}</p></div><div><p className="text-xs uppercase text-muted">Storage</p><p className="mt-1 break-all text-secondary">{version.externalReference ?? "No external reference"}</p></div><div><p className="text-xs uppercase text-muted">Change note</p><p className="mt-1 text-secondary">{version.changeNote ?? "No note"}</p></div>
        <div className="md:col-span-3"><p className="text-xs uppercase text-muted">Tags and associations</p><p className="mt-1 text-secondary">{version.tags.join(", ") || "No tags"} · {version.entityAssociations.length} Entity association{version.entityAssociations.length === 1 ? "" : "s"} · {version.derivedFromAssetIds.length} parent asset{version.derivedFromAssetIds.length === 1 ? "" : "s"}</p></div></CardContent></Card>)}</div>
  </div>;
}
