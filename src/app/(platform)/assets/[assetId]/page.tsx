import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, Clock3, ExternalLink, GitBranch, History, Package, Pencil } from "lucide-react";
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS } from "@/lib/assets/constants";
import { isHiddenResourceError } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/utils";
import { requirePlatformContext } from "@/server/context";
import { getAsset } from "@/server/services/asset-service";
import { AssetActions } from "@/components/assets/asset-actions";
import { assetStatusVariant } from "@/components/assets/asset-card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({ params }: { params: Promise<{ assetId: string }> }): Promise<Metadata> {
  const { assetId } = await params;
  try { const { user, workspace } = await requirePlatformContext(); return { title: (await getAsset(user.id, workspace.id, assetId)).name }; }
  catch { return { title: "Asset" }; }
}

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params; const { user, workspace, permissions } = await requirePlatformContext();
  let asset; try { asset = await getAsset(user.id, workspace.id, assetId); } catch (error) { if (isHiddenResourceError(error)) notFound(); throw error; }
  const version = asset.version; const canManage = permissions.includes("asset.manage");
  const complete = version.productionChecklist.filter((item) => item.completed).length;
  return <div className="space-y-6">
    <Link href="/assets" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Asset Library</Link>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-4"><span className="grid size-16 place-items-center overflow-hidden rounded-2xl border border-border-strong bg-accent-soft text-accent">
      {version.thumbnailReference ? <img src={version.thumbnailReference} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : <Package className="size-7" />}</span>
      <div><div className="flex flex-wrap gap-2"><Badge variant="outline">{ASSET_TYPE_LABELS[asset.type]}</Badge><Badge variant={assetStatusVariant(asset.status)}>{ASSET_STATUS_LABELS[asset.status]}</Badge><Badge>Version {asset.currentVersion}</Badge></div>
        <h1 className="mt-2 font-display text-2xl font-semibold">{asset.name}</h1><p className="text-sm text-muted">Updated {formatRelativeTime(asset.updatedAt)}</p></div></div>
      <div className="flex flex-wrap gap-2"><Link href={`/assets/${asset.id}/versions`} className={buttonClasses({ variant: "secondary" })}><History className="size-4" />History</Link>
        {canManage && asset.status !== "ARCHIVED" ? <Link href={`/assets/${asset.id}/edit`} className={buttonClasses({ variant: "secondary" })}><Pencil className="size-4" />Edit</Link> : null}
        {canManage ? <AssetActions asset={asset} /> : null}</div></div>
    {asset.status === "ARCHIVED" ? <div className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">This Asset is archived. Its full version history and associations remain available.</div> : null}
    <div className="grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2">
      <Card><CardHeader><CardTitle>Overview</CardTitle></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm text-secondary">{asset.description || "No description."}</p>
        <div className="flex flex-wrap gap-1.5">{asset.tags.map((tag) => <Link key={tag.id} href={`/assets?tag=${tag.slug}`}><Badge>{tag.name}</Badge></Link>)}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Storage and technical specification</CardTitle></CardHeader><CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2"><Value label="External reference" value={version.externalReference} link /><Value label="Preview reference" value={version.thumbnailReference} link />
          <Value label="Model format" value={version.modelSpecification?.format} /><Value label="Triangle count" value={version.modelSpecification?.triangleCount?.toLocaleString()} />
          <Value label="Skeleton" value={version.rigSpecification ? `${version.rigSpecification.skeletonName} ${version.rigSpecification.skeletonVersion}` : version.modelSpecification?.skeletonReference} />
          <Value label="Bone count" value={version.rigSpecification?.boneCount?.toLocaleString()} /><Value label="Animation clip" value={version.animationSpecification?.clipName} />
          <Value label="Semantic state" value={version.animationSpecification?.semanticState} /></dl>
        {Object.keys(version.technicalMetadata).length ? <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-secondary">{JSON.stringify(version.technicalMetadata, null, 2)}</pre> : null}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Production checklist</CardTitle></CardHeader><CardContent><div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-hover"><div className="h-full bg-accent" style={{ width: `${version.productionChecklist.length ? complete / version.productionChecklist.length * 100 : 0}%` }} /></div>
        <div className="grid gap-2 sm:grid-cols-2">{version.productionChecklist.map((item) => <div key={item.key} className="flex items-center gap-2 text-sm"><span className={item.completed ? "text-success" : "text-muted"}>{item.completed ? "●" : "○"}</span>{item.key.replaceAll("_", " ")}</div>)}</div></CardContent></Card>
    </div><div className="space-y-6">
      <Card><CardHeader><CardTitle>Rights and provenance</CardTitle></CardHeader><CardContent className="space-y-3"><Value label="Source" value={version.provenance.kind} /><Value label="Source name" value={version.provenance.sourceName} /><Value label="Creator" value={version.authorInfo?.name} /><Value label="Organization" value={version.authorInfo?.organization} /><Value label="License" value={version.licenseInfo ? `${version.licenseInfo.type}${version.licenseInfo.name ? ` · ${version.licenseInfo.name}` : ""}` : "Not recorded"} /><Value label="Attribution" value={version.licenseInfo?.attribution} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="size-4" />Entity associations</CardTitle></CardHeader><CardContent className="space-y-2">{asset.entities.length ? asset.entities.map((entity) => <Link key={`${entity.entityId}:${entity.purpose}`} href={`/entities/${entity.entityId}`} className="block rounded-lg border border-border p-3 text-sm hover:border-accent/40"><span className="font-medium">{entity.entityName}</span><span className="ml-2 text-muted">{entity.purpose} · v{entity.version}</span></Link>) : <p className="text-sm text-muted">No Entity associations.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="size-4" />Lineage</CardTitle></CardHeader><CardContent className="space-y-3"><RelationList title="Derived from" items={asset.parents} /><RelationList title="Derived assets" items={asset.derivedAssets} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="size-4" />Record</CardTitle></CardHeader><CardContent className="space-y-3"><Value label="Created by" value={asset.createdByName ?? "Unknown"} /><Value label="Created" value={asset.createdAt.toLocaleString()} /><Value label="Current version author" value={version.createdByName ?? "Unknown"} /><Value label="Version note" value={version.changeNote} /></CardContent></Card>
    </div></div>
  </div>;
}

function Value({ label, value, link }: { label: string; value?: string | null; link?: boolean }) {
  if (!value) return null;
  return <div><dt className="text-xs uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 break-words text-sm text-secondary">{link ? <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">{value}<ExternalLink className="size-3" /></a> : value}</dd></div>;
}
function RelationList({ title, items }: { title: string; items: { id: string; name: string; type: string }[] }) {
  return <div><p className="text-xs uppercase text-muted">{title}</p>{items.length ? <div className="mt-1 space-y-1">{items.map((item) => <Link key={item.id} href={`/assets/${item.id}`} className="block text-sm text-accent hover:underline">{item.name} <span className="text-muted">· {item.type}</span></Link>)}</div> : <p className="mt-1 text-sm text-muted">None</p>}</div>;
}
