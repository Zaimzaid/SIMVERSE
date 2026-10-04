import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listAssets } from "@/server/services/asset-service";
import { listEntities } from "@/server/services/entity-service";
import { AssetForm } from "@/components/assets/asset-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
export const metadata: Metadata = { title: "Create Asset" };
export default async function NewAssetPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("asset.manage")) return <EmptyState icon={Package} title="You cannot create assets" description="Your role has read-only Asset Library access." />;
  const [entities, assets] = await Promise.all([
    listEntities(user.id, workspace.id, { status: "ALL", sort: "name_asc", pageSize: 100 }),
    listAssets(user.id, workspace.id, { status: "ALL", sort: "name_asc", pageSize: 100 }),
  ]);
  return <div className="space-y-6"><Link href="/assets" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Asset Library</Link>
    <PageHeader icon={Package} title="Create Asset" description="Register production metadata and safe storage references. Binary files remain in external storage." />
    <AssetForm mode="create" entities={entities.items.map((entity) => ({ id: entity.id, name: entity.name, detail: entity.category }))}
      assets={assets.items.map((asset) => ({ id: asset.id, name: asset.name, detail: asset.type }))} /></div>;
}
