import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { NotFoundError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { getAsset, listAssets } from "@/server/services/asset-service";
import { listEntities } from "@/server/services/entity-service";
import { AssetForm } from "@/components/assets/asset-form";
import { assetToFormInitial } from "@/components/assets/asset-form-model";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
export const metadata: Metadata = { title: "Edit Asset" };
export default async function EditAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params; const { user, workspace, permissions } = await requirePlatformContext();
  let asset; try { asset = await getAsset(user.id, workspace.id, assetId); } catch (error) { if (error instanceof NotFoundError) notFound(); throw error; }
  if (!permissions.includes("asset.manage") || asset.status === "ARCHIVED") return <EmptyState icon={Package} title="This Asset cannot be edited" description={asset.status === "ARCHIVED" ? "Restore it before creating another version." : "Your role has read-only Asset Library access."} />;
  const [entities, assets] = await Promise.all([
    listEntities(user.id, workspace.id, { status: "ALL", sort: "name_asc", pageSize: 100 }),
    listAssets(user.id, workspace.id, { status: "ALL", sort: "name_asc", pageSize: 100 }),
  ]);
  return <div className="space-y-6"><Link href={`/assets/${asset.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />{asset.name}</Link>
    <PageHeader icon={Package} title="Create a new Asset version" description="The previous version remains immutable and inspectable." />
    <AssetForm mode="edit" initial={assetToFormInitial(asset)} entities={entities.items.map((entity) => ({ id: entity.id, name: entity.name, detail: entity.category }))}
      assets={assets.items.map((item) => ({ id: item.id, name: item.name, detail: item.type }))} /></div>;
}
