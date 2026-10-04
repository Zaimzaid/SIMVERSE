import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { ASSET_SORTS, ASSET_STATUS_FILTERS, ASSET_TYPES, type AssetSort,
  type AssetStatusFilter, type AssetType } from "@/lib/assets/constants";
import { requirePlatformContext } from "@/server/context";
import { listAssets, listAssetTags } from "@/server/services/asset-service";
import { listEntities } from "@/server/services/entity-service";
import { AssetCard } from "@/components/assets/asset-card";
import { AssetLibraryControls } from "@/components/assets/asset-library-controls";
import { AssetPagination } from "@/components/assets/asset-pagination";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Asset Library" };
type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("asset.view")) return <div className="space-y-6"><PageHeader icon={Package} title="Asset Library" description="Workspace production assets and reusable media." /><EmptyState icon={Package} title="No access to assets" description="Your role does not include Asset Library access." /></div>;
  const sp = await searchParams; const search = first(sp.q); const tag = first(sp.tag); const entityId = first(sp.entity);
  const typeRaw = first(sp.type); const type = (ASSET_TYPES as readonly string[]).includes(typeRaw) ? typeRaw as AssetType : "";
  const statusRaw = first(sp.status).toUpperCase(); const status = (ASSET_STATUS_FILTERS as readonly string[]).includes(statusRaw) ? statusRaw as AssetStatusFilter : "CURRENT";
  const sortRaw = first(sp.sort); const sort = (ASSET_SORTS as readonly string[]).includes(sortRaw) ? sortRaw as AssetSort : "updated_desc";
  const view = first(sp.view) === "list" ? "list" as const : "gallery" as const;
  const page = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);
  const [result, tags, entities] = await Promise.all([
    listAssets(user.id, workspace.id, { search, type: type || undefined, status, tag, entityId, sort, page }),
    listAssetTags(user.id, workspace.id),
    listEntities(user.id, workspace.id, { status: "ALL", sort: "name_asc", pageSize: 100 }),
  ]);
  const hrefForPage = (nextPage: number) => { const query = new URLSearchParams();
    if (search) query.set("q", search); if (type) query.set("type", type); if (status !== "CURRENT") query.set("status", status);
    if (tag) query.set("tag", tag); if (entityId) query.set("entity", entityId); if (sort !== "updated_desc") query.set("sort", sort);
    if (view === "list") query.set("view", "list"); if (nextPage > 1) query.set("page", String(nextPage));
    return query.size ? `/assets?${query}` : "/assets"; };
  const canManage = permissions.includes("asset.manage"); const filtered = search || type || status !== "CURRENT" || tag || entityId;
  return <div className="space-y-6">
    <PageHeader icon={Package} title="Asset Library" description="Versioned production assets for Web previews, future runtimes, Creator Studio, and Media systems."
      actions={canManage ? <Link href="/assets/new" className={buttonClasses()}><Plus className="size-4" />Create Asset</Link> : undefined} />
    {result.total === 0 && !filtered ? <EmptyState icon={Package} title="No assets yet" description="Create metadata for an externally stored model, image, sound, rig, animation, or other production asset."
      action={canManage ? <Link href="/assets/new" className={buttonClasses()}><Plus className="size-4" />Create your first Asset</Link> : undefined} /> : <>
      <AssetLibraryControls tags={tags} entities={entities.items.map((entity) => ({ id: entity.id, name: entity.name }))}
        current={{ search, type, status, tag, entityId, sort, view }} />
      {result.items.length ? <div className={view === "gallery" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>{result.items.map((asset) => <AssetCard key={asset.id} asset={asset} view={view} />)}</div>
        : <EmptyState icon={Package} title="No assets match these filters" description="Clear or adjust the search and filters." />}
      <AssetPagination page={result.page} pageCount={result.pageCount} total={result.total} hrefForPage={hrefForPage} />
    </>}
  </div>;
}
